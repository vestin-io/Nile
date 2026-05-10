import type { DesktopConnectionAlert, DesktopConnectionAlertMetric, DesktopConnection, SettingsState } from "../../state/Types";
import type { DesktopUsageState } from "../../state/UsageSummary";
import { ConnectionAlertStore } from "./Store";

export class ConnectionAlertOverlay {
  constructor(private readonly store: ConnectionAlertStore) {}

  decorateSettingsState(state: SettingsState): SettingsState {
    const alertsByConnectionId = this.store.listByConnectionId();
    return {
      ...state,
      currentConnection: this.decorateOptionalConnection(state.currentConnection, alertsByConnectionId),
      liveConnection: this.decorateOptionalConnection(state.liveConnection, alertsByConnectionId),
      connections: state.connections.map((connection) => this.decorateConnection(connection, alertsByConnectionId)),
      currentAgentConnections: state.currentAgentConnections.map((connection) => this.decorateConnection(connection, alertsByConnectionId)),
      agents: state.agents.map((agent) => ({
        ...agent,
        currentConnection: this.decorateOptionalConnection(agent.currentConnection, alertsByConnectionId),
        liveConnection: this.decorateOptionalConnection(agent.liveConnection, alertsByConnectionId),
        connections: agent.connections.map((connection) => this.decorateConnection(connection, alertsByConnectionId)),
      })),
    };
  }

  private decorateOptionalConnection(
    connection: DesktopConnection | null,
    alertsByConnectionId: Map<string, DesktopConnectionAlert[]>,
  ): DesktopConnection | null {
    return connection ? this.decorateConnection(connection, alertsByConnectionId) : null;
  }

  private decorateConnection(
    connection: DesktopConnection,
    alertsByConnectionId: Map<string, DesktopConnectionAlert[]>,
  ): DesktopConnection {
    const alerts = alertsByConnectionId.get(connection.id) ?? [];
    const alertMetrics = this.readAlertMetrics(connection.usage);
    return {
      ...connection,
      alerts,
      alertMetrics,
      activeAlertCount: alerts.filter((alert) => alert.enabled).length,
    };
  }

  private readAlertMetrics(usage: DesktopUsageState | null | undefined): DesktopConnectionAlertMetric[] {
    if (!usage || usage.status !== "available") {
      return [];
    }

    return usage.windows.map((window) => ({
      key: window.key,
      label: window.label,
      remainingPercent: window.remainingPercent,
      resetsAt: window.resetsAt ?? null,
    }));
  }
}
