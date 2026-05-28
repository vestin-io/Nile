import type { AgentId } from "@nile/core/models/agent";

import type { DesktopStatusEntryDisplayState } from "../../state/StatusEntryDisplay";
import type { ConnectionQuotaMetricPreferences } from "../../state/ConnectionQuotaMetricPreferences";
import {
  readStatusEntryAgentQuotaText,
  readStatusEntryAgentSummaryText,
} from "../../state/StatusEntryQuota";
import type { DesktopStatusEntryAgentState, DesktopStatusEntryState } from "../../state/Types";

export class DesktopStatusEntrySummary {
  static readSelectedAgentIds(
    state: DesktopStatusEntryState | null,
    preferences: DesktopStatusEntryDisplayState,
  ): AgentId[] {
    if (!state) {
      return preferences.selectedAgentIds;
    }
    if (preferences.hasConfiguredSelectedAgents) {
      return preferences.selectedAgentIds;
    }

    const firstAvailableAgent = state.agents.find((agent) => agent.currentUsage?.status === "available");
    return firstAvailableAgent ? [firstAvailableAgent.agentId] : [];
  }

  static toggleSelectedAgentIds(
    state: DesktopStatusEntryState | null,
    preferences: DesktopStatusEntryDisplayState,
    agentId: AgentId,
  ): AgentId[] {
    const selectedAgentIds = this.readSelectedAgentIds(state, preferences);
    if (selectedAgentIds.includes(agentId)) {
      return selectedAgentIds.filter((currentAgentId) => currentAgentId !== agentId);
    }
    return [...selectedAgentIds, agentId];
  }

  static formatSelectedAgentSummary(
    state: DesktopStatusEntryState | null,
    preferences: DesktopStatusEntryDisplayState,
    connectionQuotaMetricPreferences: ConnectionQuotaMetricPreferences = {},
  ): string {
    if (preferences.mode !== "summary" || !state) {
      return "";
    }

    const selectedAgentIds = new Set(this.readSelectedAgentIds(state, preferences));
    const parts = state.agents
      .filter((agent) => selectedAgentIds.has(agent.agentId))
      .map((agent) => readStatusEntryAgentSummaryText(agent, connectionQuotaMetricPreferences))
      .filter((value): value is string => value !== null);

    return parts.join(" | ");
  }

  static formatTrayTooltip(
    appName: string,
    state: DesktopStatusEntryState | null,
    preferences: DesktopStatusEntryDisplayState,
    connectionQuotaMetricPreferences: ConnectionQuotaMetricPreferences = {},
  ): string {
    const summary = this.formatSelectedAgentSummary(state, preferences, connectionQuotaMetricPreferences).trim();
    return summary ? `${appName} | ${summary}` : appName;
  }

  static readQuotaText(
    agent: DesktopStatusEntryAgentState,
    connectionQuotaMetricPreferences: ConnectionQuotaMetricPreferences = {},
  ): string | null {
    return readStatusEntryAgentQuotaText(agent, connectionQuotaMetricPreferences);
  }
}
