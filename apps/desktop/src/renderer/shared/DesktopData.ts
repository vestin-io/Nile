import type { AgentId } from "@nile/core/models/agent";
import { AGENT_CAPABILITIES } from "@nile/core/models/agent/capabilities";
import type { DesktopConnection } from "../../state/Types";

export type SettingsState = Awaited<ReturnType<typeof window.nileDesktop.settingsData.getSettingsState>>;
export type HistoryState = Awaited<ReturnType<typeof window.nileDesktop.settingsData.getHistoryState>>;
export type NotificationHistoryState = Awaited<ReturnType<typeof window.nileDesktop.notifications.getNotificationHistory>>;
export type Definition = Awaited<ReturnType<typeof window.nileDesktop.connections.listConnectionDefinitions>>[number];

export function canConfigureAgent(definitions: Definition[], agentId: AgentId): boolean {
  if (AGENT_CAPABILITIES.read(agentId).connectionEntryMode === "import") {
    return false;
  }
  return readDefinitionsForAgent(definitions, agentId).length > 0;
}

export function readDefinitionsForAgent(definitions: Definition[], agentId: AgentId | null): Definition[] {
  if (!agentId) {
    return definitions;
  }

  return definitions.filter((definition) => definition.selectableAgents.includes(agentId));
}

export function readCompatibleConnections(
  state: Pick<SettingsState, "connections">,
  agentId: AgentId,
): DesktopConnection[] {
  return state.connections.filter((connection) => connection.configurableAgents.includes(agentId));
}

export function hasCompatibleConnections(
  state: Pick<SettingsState, "connections">,
  agentId: AgentId,
): boolean {
  return readCompatibleConnections(state, agentId).length > 0;
}

export function readDefinitionKeywords(definition: Definition): string[] {
  return [...new Set([definition.preset, definition.label, ...definition.configurableAgents])];
}

export function orderSupportedAuthModes(
  authModes: Definition["supportedAuthModes"],
): Definition["supportedAuthModes"] {
  return [...authModes].sort((left, right) => readAuthModePriority(left) - readAuthModePriority(right));
}

function readAuthModePriority(authMode: Definition["supportedAuthModes"][number]): number {
  switch (authMode) {
    case "openai_session":
    case "openclaw_openai_session":
    case "claude_session":
    case "cursor_session":
    case "gemini_cli_session":
      return 0;
    case "api_key":
    default:
      return 1;
  }
}
