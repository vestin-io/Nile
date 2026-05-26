import type { AgentDeclarationDefinition } from "@nile/core/models/agent/registry/Types";

export const GEMINI_DECLARATION = {
  id: "gemini",
  label: "Gemini",
  iconKey: "gemini",
  requiredApplyRequirements: [],
  supportsManagedEnvBackedApiKey: false,
  requiresManagedApiKeyShellEnvironment: false,
  supportedConnectionFamilyIds: ["gemini-cli-session"],
  autoSyncMatchedSelection: true,
  connectionEntryMode: "configure_or_import",
} as const satisfies AgentDeclarationDefinition;
