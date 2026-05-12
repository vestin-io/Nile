import { SUPPORTED_AGENT_IDS } from "@nile/core/models/agent";
import type { SavedConnectionSummary } from "@nile/core/models/connection";
import type { NileSession } from "@nile/core/runtime-local";

import type { MenubarAgentState, MenubarState } from "./Types";
import { DesktopConnectionPresenter } from "./ConnectionPresenter";
import { DesktopUsageCache } from "./UsageCache";

export class DesktopMenubarStateQuery {
  constructor(
    private readonly connections: DesktopConnectionPresenter,
    private readonly usage: DesktopUsageCache,
  ) {}

  async read(session: NileSession): Promise<MenubarState> {
    const savedConnections = session.listSavedConnections();
    return {
      agents: this.buildAgents(session, savedConnections),
    };
  }

  async refreshUsage(session: NileSession): Promise<void> {
    const savedConnections = session.listSavedConnections();
    const currentConnectionIds = new Set(
      SUPPORTED_AGENT_IDS.map((agentId) => {
        const status = session.getAgentStatus(agentId);
        return this.connections.resolveEffectiveCurrentConnection(status, savedConnections)?.id ?? null;
      }).filter((connectionId): connectionId is string => connectionId !== null),
    );

    await this.usage.refreshByConnectionId(session, [...currentConnectionIds], { force: true });
  }

  private buildAgents(
    session: NileSession,
    savedConnections: SavedConnectionSummary[],
  ): MenubarAgentState[] {
    return SUPPORTED_AGENT_IDS.map((agentId) => {
      const status = session.getAgentStatus(agentId);
      const currentConnection = this.connections.resolveEffectiveCurrentConnection(status, savedConnections);
      const compatibleConnections = savedConnections.filter((connection) =>
        connection.configurableAgents.includes(agentId));
      const selectionOverride = this.connections.createSelectionDisplayOverride(agentId, currentConnection);
      const currentUsage = currentConnection
        ? this.usage.peek(currentConnection.id)
        : null;

      return {
        agentId,
        agentLabel: this.connections.formatAgentLabel(agentId),
        currentConnection,
        currentUsage,
        connections: this.connections.buildConnections(
          compatibleConnections,
          currentConnection?.id ?? null,
          undefined,
          selectionOverride,
        ),
      };
    });
  }
}
