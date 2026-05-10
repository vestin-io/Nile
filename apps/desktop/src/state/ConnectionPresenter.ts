import { formatAgentLabel as readAgentLabel, type AgentId } from "@nile/core/models/agent";
import type { SavedConnectionSummary } from "@nile/core/models/connection";
import type { AgentStatusConnection, AgentStatusView } from "@nile/core/actions/local-state";

import type { DesktopConnection, SettingsState } from "./Types";
import type { DesktopUsageState } from "./UsageSummary";

type SelectionDisplayOverride = {
  agentId: AgentId;
  connectionId: string | null;
};

export class DesktopConnectionPresenter {
  buildConnections(
    savedConnections: SavedConnectionSummary[],
    currentConnectionId: string | null,
    usageByConnectionId?: Map<string, DesktopUsageState | null>,
    selectionOverride?: SelectionDisplayOverride,
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
      activeAlertCount: 0,
      enabledAgents: [...connection.enabledAgents],
      configurableAgents: [...connection.configurableAgents],
      selectedByAgents: this.resolveDisplayedSelectedAgents(connection, selectionOverride),
    }));

    return items.sort((left, right) => {
      if (left.isCurrent !== right.isCurrent) {
        return left.isCurrent ? -1 : 1;
      }
      return left.label.localeCompare(right.label);
    });
  }

  resolveCurrentConnection(
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
        authMode: current.authMode as DesktopConnection["authMode"],
        isCurrent: true,
        activeAlertCount: 0,
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
      activeAlertCount: 0,
      enabledAgents: [...saved.enabledAgents],
      configurableAgents: [...saved.configurableAgents],
      selectedByAgents: saved.selectedByAgents as AgentId[],
    };
    if (current.appliedAt) {
      connection.appliedAt = current.appliedAt;
    }
    return connection;
  }

  resolveEffectiveCurrentConnection(
    status: AgentStatusView,
    savedConnections: SavedConnectionSummary[],
  ): DesktopConnection | null {
    const currentConnection = this.resolveCurrentConnection(status.currentConnection, savedConnections);

    if (status.syncState === "synced") {
      const liveConnection = this.resolveCurrentConnection(status.liveConnection, savedConnections);
      if (liveConnection) {
        if (currentConnection?.id === liveConnection.id) {
          return currentConnection;
        }
        return liveConnection;
      }
    }

    return currentConnection;
  }

  resolveEffectiveCurrentConnectionState(
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

  resolveLiveConnection(
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
        activeAlertCount: 0,
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
      authMode: liveConnection.authMode as DesktopConnection["authMode"],
      isCurrent: false,
      activeAlertCount: 0,
      enabledAgents: [],
      configurableAgents: [],
      selectedByAgents: [],
    };
  }

  createSelectionDisplayOverride(
    agentId: AgentId,
    currentConnection: DesktopConnection | null,
  ): SelectionDisplayOverride {
    return {
      agentId,
      connectionId: currentConnection?.id ?? null,
    };
  }

  formatAgentLabel(agentId: AgentId): string {
    return readAgentLabel(agentId);
  }

  private resolveDisplayedSelectedAgents(
    connection: SavedConnectionSummary,
    selectionOverride?: SelectionDisplayOverride,
  ): AgentId[] {
    const selectedByAgents = new Set(connection.selectedByAgents as AgentId[]);
    if (!selectionOverride) {
      return [...selectedByAgents];
    }

    selectedByAgents.delete(selectionOverride.agentId);
    if (selectionOverride.connectionId === connection.id) {
      selectedByAgents.add(selectionOverride.agentId);
    }
    return [...selectedByAgents];
  }
}
