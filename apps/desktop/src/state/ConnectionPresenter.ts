import type { SavedConnectionSummary } from "@nile/core/models/connection";
import type { AgentStatusConnection, AgentStatusView } from "@nile/core/actions/local-setup";

import type { DesktopConnection, SettingsState } from "./Types";
import type { DesktopUsageState } from "./UsageSummary";
import { DesktopConnectionListPresenter, type SelectionDisplayOverride } from "./connection/List";
import { DesktopConnectionStatusPresenter } from "./connection/Status";

export class DesktopConnectionPresenter {
  private readonly lists = new DesktopConnectionListPresenter();
  private readonly status = new DesktopConnectionStatusPresenter();

  buildConnections(
    savedConnections: SavedConnectionSummary[],
    currentConnectionId: string | null,
    usageByConnectionId?: Map<string, DesktopUsageState | null>,
    selectionOverride?: SelectionDisplayOverride,
    agentModelIdsByConnectionId?: Map<string, string | null>,
    agentId?: Parameters<DesktopConnectionListPresenter["buildConnections"]>[5],
  ): DesktopConnection[] {
    return this.lists.buildConnections(
      savedConnections,
      currentConnectionId,
      usageByConnectionId,
      selectionOverride,
      agentModelIdsByConnectionId,
      agentId,
    );
  }

  resolveCurrentConnection(
    current: AgentStatusConnection | null,
    savedConnections: SavedConnectionSummary[],
  ): DesktopConnection | null {
    return this.status.resolveCurrentConnection(current, savedConnections);
  }

  resolveEffectiveCurrentConnection(
    status: AgentStatusView,
    savedConnections: SavedConnectionSummary[],
  ): DesktopConnection | null {
    return this.status.resolveEffectiveCurrentConnection(status, savedConnections);
  }

  resolveEffectiveCurrentConnectionState(
    status: AgentStatusView,
    currentConnection: DesktopConnection | null,
  ): SettingsState["currentConnectionState"] {
    return this.status.resolveEffectiveCurrentConnectionState(status, currentConnection);
  }

  resolveLiveConnection(
    liveConnection: AgentStatusConnection | null,
    savedConnections: SavedConnectionSummary[],
    currentConnection: DesktopConnection | null,
  ): DesktopConnection | null {
    return this.status.resolveLiveConnection(liveConnection, savedConnections, currentConnection);
  }

  createSelectionDisplayOverride(
    agentId: Parameters<DesktopConnectionListPresenter["createSelectionDisplayOverride"]>[0],
    currentConnection: DesktopConnection | null,
  ): SelectionDisplayOverride {
    return this.lists.createSelectionDisplayOverride(agentId, currentConnection?.id ?? null);
  }

  formatAgentLabel(...args: Parameters<DesktopConnectionListPresenter["formatAgentLabel"]>): string {
    return this.lists.formatAgentLabel(...args);
  }
}
