import type { AgentDeclarationDefinition } from "@nile/core/models/agent/registry/Types";

export const CURSOR_DECLARATION = {
  id: "cursor",
  label: "Cursor",
  iconKey: "cursor",
  requiredApplyRequirements: [],
  supportsManagedEnvBackedApiKey: false,
  requiresManagedApiKeyShellEnvironment: false,
  supportedConnectionFamilyIds: ["cursor-api-key", "cursor-session"],
  autoSyncMatchedSelection: true,
  connectionEntryMode: "configure_or_import",
} as const satisfies AgentDeclarationDefinition;
