import type { AgentId } from "@nile/core/models/agent";

import type { ConnectionQuotaMetricPreferences } from "./ConnectionQuotaMetricPreferences";
import {
  readStatusEntryAgentBadgeText,
  readStatusEntryAgentQuotaText,
} from "./StatusEntryQuota";
import type { DesktopConnection, DesktopStatusEntryAgentState, DesktopStatusEntryState } from "./Types";

export type DesktopPresentedStatusEntryConnection = {
  authMode: DesktopConnection["authMode"];
  endpointLabel: string;
  id: string;
  isCurrent: boolean;
  label: string;
};

export type DesktopPresentedStatusEntryAgent = {
  agentId: AgentId;
  agentLabel: string;
  connections: DesktopPresentedStatusEntryConnection[];
  currentConnectionSummary: string | null;
  hasCurrentConnection: boolean;
  quotaBadgeText: string | null;
  quotaText: string | null;
};

export class DesktopStatusEntryPresenter {
  constructor(
    private readonly state: DesktopStatusEntryState,
    private readonly connectionQuotaMetricPreferences: ConnectionQuotaMetricPreferences = {},
  ) {}

  readAgents(): DesktopPresentedStatusEntryAgent[] {
    return this.state.agents.map((agent) => this.presentAgent(agent));
  }

  readConfiguredAgents(): DesktopPresentedStatusEntryAgent[] {
    return this.readAgents().filter((agent) => agent.hasCurrentConnection);
  }

  readConfiguredAgent(agentId: AgentId): DesktopPresentedStatusEntryAgent | null {
    return this.readConfiguredAgents().find((agent) => agent.agentId === agentId) ?? null;
  }

  private presentAgent(agent: DesktopStatusEntryAgentState): DesktopPresentedStatusEntryAgent {
    return {
      agentId: agent.agentId,
      agentLabel: agent.agentLabel,
      connections: agent.connections.map((connection) => this.presentConnection(connection)),
      currentConnectionSummary: agent.currentConnection
        ? `${agent.currentConnection.endpointLabel} / ${agent.currentConnection.label}`
        : null,
      hasCurrentConnection: agent.currentConnection !== null,
      quotaBadgeText: readStatusEntryAgentBadgeText(agent, this.connectionQuotaMetricPreferences),
      quotaText: readStatusEntryAgentQuotaText(agent, this.connectionQuotaMetricPreferences),
    };
  }

  private presentConnection(connection: DesktopConnection): DesktopPresentedStatusEntryConnection {
    return {
      authMode: connection.authMode,
      endpointLabel: connection.endpointLabel,
      id: connection.id,
      isCurrent: connection.isCurrent,
      label: connection.label,
    };
  }

}
