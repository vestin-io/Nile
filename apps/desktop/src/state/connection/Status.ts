import type { AgentId } from "@nile/core/models/agent";
import type { AgentStatusConnection, AgentStatusView } from "@nile/core/actions/local-setup";
import type { SavedConnectionSummary } from "@nile/core/models/connection";

import type { DesktopConnection, SettingsState } from "../Types";

export class DesktopConnectionStatusPresenter {
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
      if (current.modelId) {
        connection.agentModelId = current.modelId;
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
      selectedByAgents: [...saved.selectedByAgents] as AgentId[],
    };
    if (current.appliedAt) {
      connection.appliedAt = current.appliedAt;
    }
    if (current.modelId) {
      connection.agentModelId = current.modelId;
    }
    return connection;
  }

  resolveEffectiveCurrentConnection(
    status: AgentStatusView,
    savedConnections: SavedConnectionSummary[],
  ): DesktopConnection | null {
    const currentConnection = this.resolveCurrentConnection(status.currentConnection, savedConnections);

    if (status.reconciliation.state === "already_saved") {
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
    if (currentConnection && status.reconciliation.state === "already_saved") {
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
        ...(liveConnection.modelId ? { agentModelId: liveConnection.modelId } : {}),
        enabledAgents: [...saved.enabledAgents],
        configurableAgents: [...saved.configurableAgents],
        selectedByAgents: [...saved.selectedByAgents] as AgentId[],
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
      ...(liveConnection.modelId ? { agentModelId: liveConnection.modelId } : {}),
      enabledAgents: [],
      configurableAgents: [],
      selectedByAgents: [],
    };
  }
}
