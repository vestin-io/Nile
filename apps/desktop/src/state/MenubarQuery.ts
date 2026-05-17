import { SUPPORTED_AGENT_IDS } from "@nile/core/models/agent/definitions";
import type { SavedConnectionSummary } from "@nile/core/models/connection";
import type { NileSession } from "@nile/builtins/runtime";

import type { MenubarAgentState, MenubarState } from "./Types";
import { DesktopConnectionListPresenter } from "./connection/List";
import { DesktopConnectionStatusPresenter } from "./connection/Status";
import { DesktopUsageCache } from "./UsageCache";

export class DesktopMenubarStateQuery {
  constructor(
    private readonly lists: DesktopConnectionListPresenter,
    private readonly status: DesktopConnectionStatusPresenter,
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
        return this.status.resolveEffectiveCurrentConnection(status, savedConnections)?.id ?? null;
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
      const currentConnection = this.status.resolveEffectiveCurrentConnection(status, savedConnections);
      const compatibleConnections = savedConnections.filter((connection) =>
        connection.configurableAgents.includes(agentId));
      const selectionOverride = this.lists.createSelectionDisplayOverride(agentId, currentConnection?.id ?? null);
      const currentUsage = currentConnection
        ? this.usage.peek(currentConnection.id)
        : null;

      return {
        agentId,
        agentLabel: this.lists.formatAgentLabel(agentId),
        currentConnection,
        currentUsage,
        connections: this.lists.buildConnections(
          compatibleConnections,
          currentConnection?.id ?? null,
          undefined,
          selectionOverride,
        ),
      };
    });
  }
}
