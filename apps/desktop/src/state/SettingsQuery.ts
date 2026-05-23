import type { AgentRuntimeCommandOverrides } from "@nile/core/models/agent";
import { AGENT_MODULE_REGISTRY } from "@nile/core/models/agent/module";
import { SUPPORTED_AGENT_IDS, type AgentId } from "@nile/core/models/agent/definitions";
import type { AgentStatusView } from "@nile/core/actions/local-setup";
import type { SavedConnectionSummary } from "@nile/core/models/connection";
import type { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import type { NileSession } from "@nile/builtins/runtime";

import type { DesktopStateReadContext } from "./ReadContext";
import { DesktopConnectionListPresenter } from "./connection/List";
import { DesktopConnectionStatusPresenter } from "./connection/Status";
import type {
  DesktopAdvancedState,
  DesktopAgentState,
  DesktopOnboardingItem,
  DesktopOnboardingState,
  SettingsState,
} from "./Types";
import { DesktopUsageCache } from "./UsageCache";
import type { DesktopUsageState } from "./UsageSummary";

type DesktopSettingsStateQueryOptions = {
  agentRuntimeCommandOverrides?: AgentRuntimeCommandOverrides;
  environment: EnvironmentSource;
  resolveDesktopAgentHome(agentId: AgentId): string;
  resolveDefaultDesktopAgentHome(agentId: AgentId): string;
};

type DesktopSettingsStateReadOptions = {
  refreshUsage?: boolean;
};

export class DesktopSettingsStateQuery {
  constructor(
    private readonly options: DesktopSettingsStateQueryOptions,
    private readonly lists: DesktopConnectionListPresenter,
    private readonly status: DesktopConnectionStatusPresenter,
    private readonly usage: DesktopUsageCache,
  ) {}

  async read(session: NileSession, options: DesktopSettingsStateReadOptions = {}): Promise<SettingsState> {
    const context = this.createReadContext(session);
    return await this.readFromContext(session, context, options);
  }

  async readFromContext(
    session: NileSession,
    context: DesktopStateReadContext,
    options: DesktopSettingsStateReadOptions = {},
  ): Promise<SettingsState> {
    const savedConnections = context.savedConnections;
    const scan = context.scan;
    const statuses = context.statuses;
    const usageByConnectionId = options.refreshUsage === false
      ? this.usage.snapshotByConnectionId(savedConnections)
      : await this.usage.readByConnectionId(session, savedConnections);
    const agentStates = this.buildAgentStates(session, savedConnections, usageByConnectionId, statuses);
    const codexState = agentStates.find((state) => state.agentId === CODEX_AGENT_ID);
    if (!codexState) {
      throw new Error("Codex agent state is missing from desktop settings state");
    }
    const codexSelectionOverride = this.lists.createSelectionDisplayOverride(CODEX_AGENT_ID, codexState.currentConnection?.id ?? null);
    const codexAgentModelIdsByConnectionId = new Map(
      savedConnections.map((connection) => {
        const savedModelId = session.getAgentConnectionModel(CODEX_AGENT_ID, connection.id);
        const liveModelId = codexState.liveConnection?.id === connection.id
          ? codexState.liveConnection.agentModelId?.trim() ?? null
          : null;
        return [
          connection.id,
          savedModelId ?? liveModelId,
        ] as const;
      }),
    );
    const connections = this.lists.buildConnections(
      savedConnections,
      codexState.currentConnection?.id ?? null,
      usageByConnectionId,
      codexSelectionOverride,
    );
    const currentAgentConnections = this.lists.buildConnections(
      session.listSavedConnectionsForAgent(CODEX_AGENT_ID),
      codexState.currentConnection?.id ?? null,
      usageByConnectionId,
      codexSelectionOverride,
      codexAgentModelIdsByConnectionId,
      CODEX_AGENT_ID,
    );

    const state: SettingsState = {
      onboarding: savedConnections.length === 0 ? scan : null,
      currentConnection: codexState.currentConnection,
      currentConnectionState: codexState.currentConnectionState,
      liveConnection: codexState.liveConnection,
      reconciliationState: codexState.reconciliationState,
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
  }

  createReadContext(session: NileSession): DesktopStateReadContext {
    const statuses = this.listStatuses(session);
    return {
      savedConnections: session.listSavedConnections(),
      scan: this.buildOnboardingFromStatuses(statuses),
      statuses,
    };
  }

  private buildOnboardingFromStatuses(statuses: AgentStatusView[]): DesktopOnboardingState {
    const items = statuses.map<DesktopOnboardingItem>((status) => {
      const state = status.reconciliation.state === "unverified"
        ? "unavailable"
        : status.reconciliation.state;
      const title = status.liveConnection
        ? `${this.lists.formatAgentLabel(status.agent)} · ${status.liveConnection.label}`
        : `${this.lists.formatAgentLabel(status.agent)} · No local setup`;
      const subtitle = status.liveConnection
        ? `${status.liveConnection.endpointLabel} • ${status.liveConnection.authMode}`
        : status.liveIssues?.[0] ?? "No readable local setup detected";
      return {
        scanId: status.agent,
        agentId: status.agent,
        title,
        subtitle,
        reconciliationState: state,
        importable: state === "new",
        defaultSelected: state === "new",
        issues: [...(status.liveIssues ?? [])],
      };
    });
    const importableCount = items.filter((item) => item.importable).length;
    return {
      mode: importableCount === 0 ? "empty" : importableCount === 1 ? "single" : "multi",
      importableCount,
      items,
    };
  }

  private buildAgentStates(
    session: NileSession,
    savedConnections: SavedConnectionSummary[],
    usageByConnectionId: Map<string, DesktopUsageState | null>,
    statuses: AgentStatusView[],
  ): DesktopAgentState[] {
    const rollbackByAgent = new Map(
      session.listAgentRollbackSupport().map((entry) => [entry.agentId, entry.rollback]),
    );
    return statuses.map((status) => {
      const agentId = status.agent;
      const currentConnection = this.status.resolveEffectiveCurrentConnection(status, savedConnections);
      const liveConnection = this.status.resolveLiveConnection(status.liveConnection, savedConnections, currentConnection);
      const selectionOverride = this.lists.createSelectionDisplayOverride(agentId, currentConnection?.id ?? null);
      const agentModelIdsByConnectionId = new Map(
        savedConnections.map((connection) => {
          const savedModelId = session.getAgentConnectionModel(agentId, connection.id);
          const liveModelId = status.liveConnection?.id === connection.id
            ? status.liveConnection.modelId?.trim() ?? null
            : null;
          return [
            connection.id,
            savedModelId ?? liveModelId,
          ] as const;
        }),
      );
      const connections = this.lists.buildConnections(
        session.listSavedConnectionsForAgent(agentId),
        currentConnection?.id ?? null,
        usageByConnectionId,
        selectionOverride,
        agentModelIdsByConnectionId,
        agentId,
      );
      const state: DesktopAgentState = {
        agentId,
        agentLabel: this.lists.formatAgentLabel(agentId),
        canRollback: rollbackByAgent.get(agentId) === "yes",
        latestRollbackableMutationId: session.getLatestRollbackableMutation(agentId, "settings-state")?.id ?? null,
        currentConnection,
        currentUsage: currentConnection ? (usageByConnectionId.get(currentConnection.id) ?? null) : null,
        currentConnectionState: this.status.resolveEffectiveCurrentConnectionState(status, currentConnection),
        liveConnection,
        reconciliationState: status.reconciliation.state,
        connections,
      };
      if (status.liveIssues && status.liveIssues.length > 0) {
        state.liveIssues = status.liveIssues;
      }
      return state;
    });
  }

  private listStatuses(session: NileSession): AgentStatusView[] {
    return session.listAgentStatuses([...SUPPORTED_AGENT_IDS]);
  }

  private buildAdvancedState(
    savedConnections: SavedConnectionSummary[],
    scan: DesktopOnboardingState,
  ): DesktopAdvancedState {
    return {
      agentHomes: SUPPORTED_AGENT_IDS.map((agentId) => ({
        agentId,
        agentLabel: this.lists.formatAgentLabel(agentId),
        path: this.options.resolveDesktopAgentHome(agentId),
        defaultPath: this.options.resolveDefaultDesktopAgentHome(agentId),
        ...this.readAgentHomeRuntimeInfo(agentId),
      })),
      supportedAgents: SUPPORTED_AGENT_IDS.map((agentId) => ({
        agentId,
        agentLabel: this.lists.formatAgentLabel(agentId),
      })),
      savedConnectionCount: savedConnections.length,
      importableSetupCount: scan.importableCount,
    };
  }

  private readAgentHomeRuntimeInfo(
    agentId: AgentId,
  ): { runtimeCommandOverridePath?: string | null; runtimeCommandPath?: string | null } {
    const module = AGENT_MODULE_REGISTRY.list().find((entry) => entry.manifest.id === agentId);
    if (!module?.localRuntimeInfo) {
      return {};
    }

    const commandPathOverride = this.options.agentRuntimeCommandOverrides?.[agentId]?.trim() || null;
    const runtimeInfo = module.localRuntimeInfo.read({
      runtimeCommandPathOverride: commandPathOverride,
      environment: this.options.environment,
    });
    return runtimeInfo.runtimeCommandPath !== undefined ? {
      runtimeCommandOverridePath: commandPathOverride,
      ...runtimeInfo,
    } : {
      runtimeCommandOverridePath: commandPathOverride,
    };
  }
}

const CODEX_AGENT_ID: AgentId = "codex";
