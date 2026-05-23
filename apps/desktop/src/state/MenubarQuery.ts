import { SUPPORTED_AGENT_IDS } from "@nile/core/models/agent/definitions";
import type { AgentStatusView } from "@nile/core/actions/local-setup";
import type { SavedConnectionSummary } from "@nile/core/models/connection";
import type { NileSession } from "@nile/builtins/runtime";

import type { DesktopStateReadContext } from "./ReadContext";
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
    return this.readFromContext({
      savedConnections: session.listSavedConnections(),
      statuses: this.listStatuses(session),
    });
  }

  readFromContext(context: Pick<DesktopStateReadContext, "savedConnections" | "statuses">): MenubarState {
    return {
      agents: this.buildAgents(context.savedConnections, context.statuses),
    };
  }

  async refreshUsage(session: NileSession): Promise<void> {
    const savedConnections = session.listSavedConnections();
    const statuses = this.listStatuses(session);
    const currentConnectionIds = new Set(
      statuses.map((status) => {
        return this.status.resolveEffectiveCurrentConnection(status, savedConnections)?.id ?? null;
      }).filter((connectionId): connectionId is string => connectionId !== null),
    );

    await this.usage.refreshByConnectionId(session, [...currentConnectionIds], { force: true });
  }

  private buildAgents(
    savedConnections: SavedConnectionSummary[],
    statuses: AgentStatusView[],
  ): MenubarAgentState[] {
    return statuses.map((status) => {
      const agentId = status.agent;
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

  private listStatuses(session: NileSession): AgentStatusView[] {
    return session.listAgentStatuses([...SUPPORTED_AGENT_IDS]);
  }
}
