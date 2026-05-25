import type { AgentId } from "@nile/core/models/agent/definitions";

import type { DesktopStatusEntryAgentState, DesktopStatusEntryState } from "../../state/Types";
import type { ConnectionQuotaMetricPreferences } from "../../state/ConnectionQuotaMetricPreferences";
import type { DesktopStatusEntryDisplayState } from "../state/StatusEntryDisplayStore";
import {
  readConnectionQuotaMetricPreference,
} from "../../state/ConnectionQuotaMetricPreferences";
import { resolveDesktopUsageSummary } from "../../state/UsageSummary";

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

  static formatTickerTitle(
    state: DesktopStatusEntryState | null,
    preferences: DesktopStatusEntryDisplayState,
    connectionQuotaMetricPreferences: ConnectionQuotaMetricPreferences = {},
  ): string {
    if (preferences.mode !== "ticker" || !state) {
      return "";
    }

    const selectedAgentIds = new Set(this.readSelectedAgentIds(state, preferences));
    const parts = state.agents
      .filter((agent) => selectedAgentIds.has(agent.agentId))
      .map((agent) => this.readTickerAgentSummary(agent, connectionQuotaMetricPreferences))
      .filter((value): value is string => value !== null);

    return parts.join(" · ");
  }

  static formatTrayTooltip(
    appName: string,
    state: DesktopStatusEntryState | null,
    preferences: DesktopStatusEntryDisplayState,
    connectionQuotaMetricPreferences: ConnectionQuotaMetricPreferences = {},
  ): string {
    const summary = this.formatTickerTitle(state, preferences, connectionQuotaMetricPreferences).trim();
    return summary ? `${appName} · ${summary}` : appName;
  }

  static readQuotaText(
    agent: DesktopStatusEntryAgentState,
    connectionQuotaMetricPreferences: ConnectionQuotaMetricPreferences = {},
  ): string | null {
    if (!agent.currentConnection || agent.currentUsage?.status !== "available") {
      return null;
    }
    const preferredMetricKey = readConnectionQuotaMetricPreference(
      connectionQuotaMetricPreferences,
      agent.currentConnection.id,
    );
    const summary = resolveDesktopUsageSummary(agent.currentUsage, preferredMetricKey);
    return summary?.text ?? null;
  }

  private static readTickerAgentSummary(
    agent: DesktopStatusEntryAgentState,
    connectionQuotaMetricPreferences: ConnectionQuotaMetricPreferences = {},
  ): string | null {
    if (!agent.currentConnection || agent.currentUsage?.status !== "available") {
      return null;
    }
    const preferredMetricKey = readConnectionQuotaMetricPreference(
      connectionQuotaMetricPreferences,
      agent.currentConnection.id,
    );
    const summary = resolveDesktopUsageSummary(agent.currentUsage, preferredMetricKey);
    return summary ? `${agent.agentLabel} ${summary.remainingPercent}%` : null;
  }
}
