import type { AgentDeclarationDefinition } from "@nile/core/models/agent/registry/Types";

export const CODEX_DECLARATION = {
  id: "codex",
  label: "Codex",
  iconKey: "codex",
  requiredApplyRequirements: [],
  supportsManagedEnvBackedApiKey: true,
  requiresManagedApiKeyShellEnvironment: false,
  supportedConnectionFamilyIds: ["openai-api-key", "openai-session"],
  autoSyncMatchedSelection: true,
  connectionEntryMode: "configure_or_import",
} as const satisfies AgentDeclarationDefinition;
