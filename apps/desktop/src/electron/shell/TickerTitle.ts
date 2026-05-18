import type { AgentId } from "@nile/core/models/agent/definitions";

import type { MenubarState } from "../../state/Types";
import type { DesktopMenubarDisplayState } from "../state/MenubarDisplayStore";

export class DesktopTrayTickerTitle {
  static readSelectedAgentIds(
    state: MenubarState | null,
    preferences: DesktopMenubarDisplayState,
  ): AgentId[] {
    if (!state) {
      return preferences.tickerAgentIds;
    }
    if (preferences.hasConfiguredTickerAgents) {
      return preferences.tickerAgentIds;
    }

    const firstAvailableAgent = state.agents.find((agent) => agent.currentUsage?.status === "available");
    return firstAvailableAgent ? [firstAvailableAgent.agentId] : [];
  }

  static toggleSelectedAgentIds(
    state: MenubarState | null,
    preferences: DesktopMenubarDisplayState,
    agentId: AgentId,
  ): AgentId[] {
    const selectedAgentIds = this.readSelectedAgentIds(state, preferences);
    if (selectedAgentIds.includes(agentId)) {
      return selectedAgentIds.filter((currentAgentId) => currentAgentId !== agentId);
    }
    return [...selectedAgentIds, agentId];
  }

  static format(
    state: MenubarState | null,
    preferences: DesktopMenubarDisplayState,
  ): string {
    if (preferences.mode !== "ticker" || !state) {
      return "";
    }

    const selectedAgentIds = new Set(this.readSelectedAgentIds(state, preferences));
    const parts = state.agents
      .filter((agent) => selectedAgentIds.has(agent.agentId))
      .map((agent) => {
        if (agent.currentUsage?.status !== "available") {
          return null;
        }
        return `${agent.agentLabel} ${agent.currentUsage.remainingPercent}%`;
      })
      .filter((value): value is string => value !== null);

    return parts.join(" · ");
  }
}
