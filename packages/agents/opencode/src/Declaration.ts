import type { AgentDeclarationDefinition } from "@nile/core/models/agent/registry/Types";

export const OPENCODE_DECLARATION = {
  id: "opencode",
  label: "OpenCode",
  iconKey: "opencode",
  requiredApplyRequirements: ["selected-model", "env-backed-api-key"],
  supportsManagedEnvBackedApiKey: true,
  requiresManagedApiKeyShellEnvironment: true,
  supportedConnectionFamilyIds: ["openai-api-key", "openai-session", "anthropic-api-key"],
  autoSyncMatchedSelection: false,
  connectionEntryMode: "configure_or_import",
} as const satisfies AgentDeclarationDefinition;
