import type { AgentId } from "@nile/core/models/agent/types";

export type SettingsState = Awaited<ReturnType<typeof window.nileDesktop.state.getSettingsState>>;
export type HistoryState = Awaited<ReturnType<typeof window.nileDesktop.state.getHistoryState>>;
export type NotificationHistoryState = Awaited<ReturnType<typeof window.nileDesktop.state.getNotificationHistory>>;
export type Definition = Awaited<ReturnType<typeof window.nileDesktop.connections.listConnectionDefinitions>>[number];

export function canConfigureAgent(definitions: Definition[], agentId: AgentId): boolean {
  return definitions.some((definition) => definition.configurableAgents.includes(agentId));
}

export function readDefinitionsForAgent(definitions: Definition[], agentId: AgentId | null): Definition[] {
  if (!agentId) {
    return definitions;
  }

  const matchingDefinitions = definitions.filter((definition) => definition.configurableAgents.includes(agentId));
  return matchingDefinitions.length > 0 ? matchingDefinitions : definitions;
}
