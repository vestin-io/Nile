import type { Definition } from "./DesktopData";

export { type Definition } from "./DesktopData";

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
    case "claude_session":
    case "cursor_session":
      return 0;
    case "api_key":
    default:
      return 1;
  }
}
