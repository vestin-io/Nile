import type { AgentDeclarationDefinition } from "@nile/core/models/agent/registry/Types";

export const CLAUDE_DECLARATION = {
  id: "claude",
  label: "Claude",
  iconKey: "claude",
  requiredApplyRequirements: [],
  supportsManagedEnvBackedApiKey: true,
  supportedConnectionFamilyIds: ["anthropic-api-key", "claude-session"],
  autoSyncMatchedSelection: true,
  connectionEntryMode: "configure_or_import",
} as const satisfies AgentDeclarationDefinition;
