import { homedir } from "node:os";
import { join } from "node:path";

import {
  type AgentHomes,
  resolveAgentHome,
  SUPPORTED_AGENT_IDS,
  type AgentId,
} from "@nile/core/models/agent";
import { type SavedConnectionSummary } from "@nile/core/models/connection";
import type { AgentStatusConnection, AgentStatusView } from "@nile/core/runtime-local";
import { NileSession } from "@nile/core/runtime-local";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import {
  type CredentialStore,
  KeychainCredentialStore,
} from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import type { SecureSnapshotStore } from "@nile/core/services/history";
import { CODEX_AGENT_ID } from "@nile/core/agents";

import {
  type DesktopAdvancedState,
  type DesktopAgentState,
  type DesktopConnection,
  type DesktopHistoryAgentState,
  type HistoryState,
  type DesktopOnboardingState,
  type DesktopOnboardingItem,
  type DesktopHistoryEntry,
  type MenubarAgentState,
  type MenubarState,
  type SettingsState,
} from "./DesktopTypes";
import { type DesktopUsageState, UsageSummary } from "./UsageSummary";

type DesktopSurfaceOptions = {
  databasePath: string;
  agentHomes?: AgentHomes;
  environment?: EnvironmentSource;
  credentialStore: CredentialStore;
  secureSnapshotStore?: SecureSnapshotStore;
  logger?: NileLogger;
};

export class DesktopSurface {
  private static readonly USAGE_CACHE_TTL_MS = 60_000;
  private static readonly USAGE_REFRESH_CONCURRENCY = 4;

  private readonly logger: NileLogger;
  private readonly usageCache = new Map<string, DesktopUsageState | null>();
  private readonly usageCacheReadAt = new Map<string, number>();
  private menubarUsageRefresh: Promise<void> | null = null;

  constructor(
    private readonly options: DesktopSurfaceOptions,
  ) {
    this.logger = options.logger ?? NileLogger.createDefault({ module: "desktop" });
  }

  async getMenubarState(): Promise<MenubarState> {
    const state = await this.withSession("menubar-state", async (session) => {
      const savedConnections = session.listSavedConnections();
      const agents = this.buildMenubarAgents(session, savedConnections);
      return {
        agents,
      };
    });

    if (state.agents.some((agent) => agent.currentConnection && agent.currentUsage === null)) {
      void this.refreshMenubarUsage();
    }

    return state;
  }

  async refreshMenubarUsage(): Promise<void> {
    if (this.menubarUsageRefresh) {
      return await this.menubarUsageRefresh;
    }

    this.menubarUsageRefresh = this.withSession("menubar-usage-refresh", async (session) => {
      const savedConnections = session.listSavedConnections();
      const currentConnectionIds = new Set(
        SUPPORTED_AGENT_IDS.map((agentId) => {
          const status = session.getAgentStatus(agentId);
          return this.resolveEffectiveCurrentConnection(status, savedConnections)?.id ?? null;
        }).filter((connectionId): connectionId is string => connectionId !== null),
      );

      await this.refreshUsageByConnectionId(session, [...currentConnectionIds], { force: true });
    }).finally(() => {
      this.menubarUsageRefresh = null;
    });

    return await this.menubarUsageRefresh;
  }

  async getSettingsState(): Promise<SettingsState> {
    return await this.withSession("settings-state", async (session) => {
      const savedConnections = session.listSavedConnections();
      const scan = this.buildOnboarding(session);
      const usageByConnectionId = await this.readUsageByConnectionId(session, savedConnections);
      const agentStates = this.buildAgentStates(session, savedConnections, usageByConnectionId);
      const codexState = agentStates.find((state) => state.agentId === CODEX_AGENT_ID);
      if (!codexState) {
        throw new Error("Codex agent state is missing from desktop settings state");
      }
      const connections = this.buildConnections(
        savedConnections,
        codexState.currentConnection?.id ?? null,
        usageByConnectionId,
      );
      const currentAgentConnections = this.buildConnections(
        savedConnections.filter((connection) => connection.enabledAgents.includes(CODEX_AGENT_ID)),
        codexState.currentConnection?.id ?? null,
        usageByConnectionId,
      );

      const state: SettingsState = {
        onboarding: savedConnections.length === 0 ? scan : null,
        currentConnection: codexState.currentConnection,
        currentConnectionState: codexState.currentConnectionState,
        liveConnection: codexState.liveConnection,
        syncState: codexState.syncState,
        connections,
        currentAgentConnections,
        agents: agentStates,
        detectedSetups: scan,
        advanced: this.buildAdvancedState(savedConnections, scan),
      };

      if (codexState.liveIssues && codexState.liveIssues.length > 0) {
        state.liveIssues = codexState.liveIssues;
      }

      return state;
    });
  }

  async importDetectedSetups(scanIds: AgentId[]) {
    return await this.withSession("import-detected-setups", async (session) =>
      session.importDetectedSetups({
        selections: scanIds.map((scanId) => ({ scanId })),
      }),
    );
  }

  async getHistoryState(): Promise<HistoryState> {
    return await this.withSession("history-state", async (session) => {
      const capabilitiesByAgent = new Map(
        session.listAgentCapabilities().map((entry) => [entry.agentId, entry.capabilities]),
      );
      const entries = session.listMutationHistory(20).map<DesktopHistoryEntry>((entry) => ({
        id: entry.id,
        agentId: entry.agentId,
        agentLabel: this.formatAgentLabel(entry.agentId),
        type: entry.type,
        status: entry.status,
        connectionId: entry.connectionId,
        connectionLabel: entry.connectionLabel,
        endpointLabel: entry.endpointLabel,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt,
        errorMessage: entry.errorMessage,
        fileCount: entry.files.length,
      }));

      return {
        agents: SUPPORTED_AGENT_IDS.map<DesktopHistoryAgentState>((agentId) => ({
          agentId,
          agentLabel: this.formatAgentLabel(agentId),
          canRollback: capabilitiesByAgent.get(agentId)?.rollback === "yes",
          latestRollbackableMutationId: session.getLatestRollbackableMutation(agentId, "history-state")?.id ?? null,
        })),
        entries,
      };
    });
  }

  async rollbackLatestMutation(agentId: AgentId) {
    return await this.withSession("rollback-latest", async (session) => session.rollbackLatestMutation(agentId));
  }

  async switchConnection(agentId: AgentId, connectionId: string): Promise<DesktopConnection> {
    return await this.withSession("apply-selection", async (session) => {
      this.logger.info("desktop.switch.start", {
        agentId,
        connectionId,
      });

      const previousSavedConnections = session.listSavedConnections();
      const previousStatus = session.getAgentStatus(agentId);
      const previousConnectionId = this.resolveEffectiveCurrentConnection(
        previousStatus,
        previousSavedConnections,
      )?.id ?? null;
      const applied = session.useConnection(agentId, connectionId);
      const savedConnections = session.listSavedConnections();
      const status = session.getAgentStatus(agentId);
      const currentConnection = this.resolveCurrentConnection(
        status.currentConnection,
        savedConnections,
      );
      if (!currentConnection) {
        throw new Error(`Current connection missing after apply for ${applied.endpointId}/${applied.accessId}`);
      }
      await this.refreshUsageByConnectionId(session, [previousConnectionId, currentConnection.id], { force: true });
      return currentConnection;
    });
  }

  private buildMenubarAgents(
    session: NileSession,
    savedConnections: SavedConnectionSummary[],
  ): MenubarAgentState[] {
    return SUPPORTED_AGENT_IDS.map((agentId) => {
      const status = session.getAgentStatus(agentId);
      const currentConnection = this.resolveEffectiveCurrentConnection(status, savedConnections);
      const compatibleConnections = savedConnections.filter((connection) => connection.enabledAgents.includes(agentId));
      const currentUsage = currentConnection
        ? (this.usageCache.get(currentConnection.id) ?? null)
        : null;

      return {
        agentId,
        agentLabel: this.formatAgentLabel(agentId),
        currentConnection,
        currentUsage,
        connections: this.buildConnections(compatibleConnections, currentConnection?.id ?? null),
      };
    });
  }

  private buildConnections(
    savedConnections: SavedConnectionSummary[],
    currentConnectionId: string | null,
    usageByConnectionId?: Map<string, DesktopUsageState | null>,
  ): DesktopConnection[] {
    const items: DesktopConnection[] = savedConnections.map((connection) => ({
      id: connection.id,
      label: connection.label,
      endpointUrl: connection.endpointUrl,
      endpointLabel: connection.endpointLabel,
      endpointFamily: (connection.endpointFamily ?? "unknown") as DesktopConnection["endpointFamily"],
      authMode: connection.authMode,
      apiKeySource: connection.apiKeySource,
      envKey: connection.envKey,
      isCurrent: currentConnectionId === connection.id,
      usage: usageByConnectionId?.get(connection.id) ?? null,
      enabledAgents: [...connection.enabledAgents],
      configurableAgents: [...connection.configurableAgents],
      selectedByAgents: connection.selectedByAgents as AgentId[],
    }));

    return items.sort((left, right) => {
      if (left.isCurrent !== right.isCurrent) {
        return left.isCurrent ? -1 : 1;
      }
      return left.label.localeCompare(right.label);
    });
  }

  private buildOnboarding(session: NileSession): DesktopOnboardingState {
    const scan = session.scanLocalSetups();
    const items = scan.items.map<DesktopOnboardingItem>((item) => ({
      scanId: item.scanId,
      agentId: item.agentId,
      title: item.title,
      subtitle: item.subtitle,
      state: item.state,
      importable: item.importable,
      defaultSelected: item.defaultSelected,
      matchedConnectionLabel: item.matchedConnectionLabel,
      issues: [...item.issues],
    }));

    return {
      mode: scan.importableCount === 0 ? "empty" : scan.importableCount === 1 ? "single" : "multi",
      importableCount: scan.importableCount,
      items,
    };
  }

  private buildAgentStates(
    session: NileSession,
    savedConnections: SavedConnectionSummary[],
    usageByConnectionId: Map<string, DesktopUsageState | null>,
  ): DesktopAgentState[] {
    const capabilitiesByAgent = new Map(
      session.listAgentCapabilities().map((entry) => [entry.agentId, entry.capabilities]),
    );
    return SUPPORTED_AGENT_IDS.map((agentId) => {
      const status = session.getAgentStatus(agentId);
      const currentConnection = this.resolveEffectiveCurrentConnection(status, savedConnections);
      const liveConnection = this.resolveLiveConnection(status.liveConnection, savedConnections, currentConnection);
      const connections = this.buildConnections(
        savedConnections.filter((connection) =>
          connection.enabledAgents.includes(agentId),
        ),
        currentConnection?.id ?? null,
        usageByConnectionId,
      );
      const state: DesktopAgentState = {
        agentId,
        agentLabel: this.formatAgentLabel(agentId),
        canRollback: capabilitiesByAgent.get(agentId)?.rollback === "yes",
        latestRollbackableMutationId: session.getLatestRollbackableMutation(agentId, "settings-state")?.id ?? null,
        currentConnection,
        currentUsage: currentConnection ? (usageByConnectionId.get(currentConnection.id) ?? null) : null,
        currentConnectionState: this.resolveEffectiveCurrentConnectionState(status, currentConnection),
        liveConnection,
        syncState: status.syncState,
        connections,
      };
      if (status.liveIssues && status.liveIssues.length > 0) {
        state.liveIssues = status.liveIssues;
      }
      return state;
    });
  }

  private buildAdvancedState(
    savedConnections: SavedConnectionSummary[],
    scan: DesktopOnboardingState,
  ): DesktopAdvancedState {
    return {
      agentHomes: SUPPORTED_AGENT_IDS.map((agentId) => ({
        agentId,
        agentLabel: this.formatAgentLabel(agentId),
        path: this.resolveDesktopAgentHome(agentId),
        defaultPath: resolveAgentHome(agentId),
      })),
      supportedAgents: SUPPORTED_AGENT_IDS.map((agentId) => ({
        agentId,
        agentLabel: this.formatAgentLabel(agentId),
      })),
      savedConnectionCount: savedConnections.length,
      importableSetupCount: scan.importableCount,
    };
  }

  private resolveCurrentConnection(
    current: AgentStatusConnection | null,
    savedConnections: SavedConnectionSummary[],
  ): DesktopConnection | null {
    if (!current) {
      return null;
    }

    const saved = current.id ? savedConnections.find((connection) => connection.id === current.id) : null;
    if (!saved) {
      const connection: DesktopConnection = {
        id: current.id ?? current.label,
        label: current.label,
        endpointUrl: null,
        endpointLabel: current.endpointLabel,
        endpointFamily: current.endpointFamily,
        authMode: current.authMode,
        isCurrent: true,
        enabledAgents: [],
        configurableAgents: [],
        selectedByAgents: [],
      };
      if (current.appliedAt) {
        connection.appliedAt = current.appliedAt;
      }
      return connection;
    }

    const connection: DesktopConnection = {
      id: saved.id,
      label: saved.label,
      endpointUrl: saved.endpointUrl,
      endpointLabel: saved.endpointLabel,
      endpointFamily: saved.endpointFamily ?? "unknown",
      authMode: saved.authMode,
      apiKeySource: saved.apiKeySource,
      envKey: saved.envKey,
      isCurrent: true,
      enabledAgents: [...saved.enabledAgents],
      configurableAgents: [...saved.configurableAgents],
      selectedByAgents: saved.selectedByAgents as AgentId[],
    };
    if (current.appliedAt) {
      connection.appliedAt = current.appliedAt;
    }
    return connection;
  }

  private resolveEffectiveCurrentConnection(
    status: AgentStatusView,
    savedConnections: SavedConnectionSummary[],
  ): DesktopConnection | null {
    const currentConnection = this.resolveCurrentConnection(status.currentConnection, savedConnections);
    if (currentConnection) {
      return currentConnection;
    }
    if (status.syncState !== "synced") {
      return null;
    }
    return this.resolveCurrentConnection(status.liveConnection, savedConnections);
  }

  private resolveEffectiveCurrentConnectionState(
    status: AgentStatusView,
    currentConnection: DesktopConnection | null,
  ): SettingsState["currentConnectionState"] {
    if (status.currentConnectionState !== "none") {
      return status.currentConnectionState;
    }
    if (currentConnection && status.syncState === "synced") {
      return "saved";
    }
    return "none";
  }

  private resolveLiveConnection(
    liveConnection: AgentStatusConnection | null,
    savedConnections: SavedConnectionSummary[],
    currentConnection: DesktopConnection | null,
  ): DesktopConnection | null {
    if (!liveConnection) {
      return null;
    }

    const saved = liveConnection.id
      ? savedConnections.find((connection) => connection.id === liveConnection.id)
      : null;
    if (saved) {
      return {
        id: saved.id,
        label: saved.label,
        endpointUrl: saved.endpointUrl,
        endpointLabel: saved.endpointLabel,
        endpointFamily: saved.endpointFamily ?? "unknown",
        authMode: saved.authMode,
        apiKeySource: saved.apiKeySource,
        envKey: saved.envKey,
        isCurrent: currentConnection?.id === saved.id,
        enabledAgents: [...saved.enabledAgents],
        configurableAgents: [...saved.configurableAgents],
        selectedByAgents: saved.selectedByAgents as AgentId[],
      };
    }

    return {
      id: liveConnection.id ?? liveConnection.label,
      label: liveConnection.label,
      endpointUrl: null,
      endpointLabel: liveConnection.endpointLabel,
      endpointFamily: liveConnection.endpointFamily,
      authMode: liveConnection.authMode,
      isCurrent: false,
      enabledAgents: [],
      configurableAgents: [],
      selectedByAgents: [],
    };
  }

  private formatAgentLabel(agentId: AgentId): string {
    if (agentId === "openclaw") {
      return "OpenClaw";
    }
    return agentId.charAt(0).toUpperCase() + agentId.slice(1);
  }

  private resolveDesktopAgentHome(agentId: AgentId): string {
    return this.options.agentHomes?.[agentId] ?? resolveAgentHome(agentId);
  }

  private async readUsageByConnectionId(
    session: NileSession,
    savedConnections: SavedConnectionSummary[],
  ): Promise<Map<string, DesktopUsageState | null>> {
    return await this.refreshUsageByConnectionId(
      session,
      savedConnections.map((connection) => connection.id),
    );
  }

  private async refreshUsageByConnectionId(
    session: NileSession,
    connectionIds: Array<string | null>,
    options?: { force: boolean },
  ): Promise<Map<string, DesktopUsageState | null>> {
    const uniqueConnectionIds = [...new Set(connectionIds.filter((connectionId): connectionId is string => Boolean(connectionId)))];
    const forceRefresh = options?.force ?? false;
    const shouldRefresh = uniqueConnectionIds.filter((connectionId) =>
      forceRefresh || !this.hasFreshUsageCache(connectionId),
    );

    if (shouldRefresh.length > 0) {
      await this.refreshUsageBatch(session, shouldRefresh);
    }

    const now = Date.now();
    const usageByConnectionId = new Map<string, DesktopUsageState | null>();
    for (const connectionId of uniqueConnectionIds) {
      if (!this.usageCache.has(connectionId)) {
        this.usageCache.set(connectionId, null);
        this.usageCacheReadAt.set(connectionId, now);
      }
      usageByConnectionId.set(connectionId, this.usageCache.get(connectionId) ?? null);
    }
    return usageByConnectionId;
  }

  private async refreshUsageBatch(session: NileSession, connectionIds: string[]): Promise<void> {
    const queue = [...connectionIds];
    const workerCount = Math.min(DesktopSurface.USAGE_REFRESH_CONCURRENCY, queue.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (queue.length > 0) {
        const connectionId = queue.shift();
        if (!connectionId) {
          return;
        }
        const summary = await this.readUsageSummary(session, connectionId);
        this.usageCache.set(connectionId, summary);
        this.usageCacheReadAt.set(connectionId, Date.now());
      }
    });
    await Promise.all(workers);
  }

  private hasFreshUsageCache(connectionId: string): boolean {
    const readAt = this.usageCacheReadAt.get(connectionId);
    if (typeof readAt !== "number") {
      return false;
    }
    return Date.now() - readAt <= DesktopSurface.USAGE_CACHE_TTL_MS;
  }

  private async readUsageSummary(
    session: NileSession,
    connectionId: string,
  ): Promise<DesktopUsageState | null> {
    try {
      const result = await session.getConnectionUsage(connectionId);
      return UsageSummary.fromResult(result);
    } catch (error) {
      this.logger.warn("desktop.usage.read_failed", {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private openSession(scope: string): NileSession {
    return NileSession.open({
      databasePath: this.options.databasePath,
      agentHomes: this.options.agentHomes,
      environment: this.options.environment,
      credentialStore: this.options.credentialStore,
      secureSnapshotStore: this.options.secureSnapshotStore,
      logger: this.logger.child({ scope }),
    });
  }

  private async withSession<TResult>(scope: string, work: (session: NileSession) => Promise<TResult>): Promise<TResult> {
    const session = this.openSession(scope);
    try {
      return await work(session);
    } catch (error) {
      throw this.normalizeDesktopStateError(error);
    } finally {
      session.close();
    }
  }

  private normalizeDesktopStateError(error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("no such column:")) {
      return new Error(
        "Local Nile state schema is stale. Reset Nile state from Settings or run `nile reset --yes`, then restart Nile.",
      );
    }
    return error instanceof Error ? error : new Error(message);
  }
}

export function createDefaultDesktopSurface(): DesktopSurface {
  return new DesktopSurface({
    databasePath: join(homedir(), ".nile-switcher", "switcher.sqlite"),
    agentHomes: {
      codex: resolveAgentHome("codex"),
    },
    credentialStore: new KeychainCredentialStore(),
  });
}
