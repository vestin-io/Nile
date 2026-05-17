import { SUPPORTED_AGENT_IDS, type AgentId } from "@nile/core/models/agent/definitions";
import type { SavedConnectionSummary } from "@nile/core/models/connection";
import type { NileSession } from "@nile/builtins/runtime";

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
    const savedConnections = session.listSavedConnections();
    const scan = this.buildOnboarding(session);
    const usageByConnectionId = options.refreshUsage === false
      ? this.usage.snapshotByConnectionId(savedConnections)
      : await this.usage.readByConnectionId(session, savedConnections);
    const agentStates = this.buildAgentStates(session, savedConnections, usageByConnectionId);
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

  private buildOnboarding(session: NileSession): DesktopOnboardingState {
    const scan = session.scanLocalSetups();
    const items = scan.items.map<DesktopOnboardingItem>((item) => ({
      scanId: item.scanId,
      agentId: item.agentId,
      title: item.title,
      subtitle: item.subtitle,
      reconciliationState: item.state,
      importable: item.importable,
      defaultSelected: item.defaultSelected,
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
    const rollbackByAgent = new Map(
      session.listAgentRollbackSupport().map((entry) => [entry.agentId, entry.rollback]),
    );
    return SUPPORTED_AGENT_IDS.map((agentId) => {
      const status = session.getAgentStatus(agentId);
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
      })),
      supportedAgents: SUPPORTED_AGENT_IDS.map((agentId) => ({
        agentId,
        agentLabel: this.lists.formatAgentLabel(agentId),
      })),
      savedConnectionCount: savedConnections.length,
      importableSetupCount: scan.importableCount,
    };
  }
}

const CODEX_AGENT_ID: AgentId = "codex";
