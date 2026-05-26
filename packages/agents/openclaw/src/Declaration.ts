import type { AgentDeclarationDefinition } from "@nile/core/models/agent/registry/Types";

export const OPENCLAW_DECLARATION = {
  id: "openclaw",
  label: "OpenClaw",
  iconKey: "openclaw",
  requiredApplyRequirements: ["selected-model", "env-backed-api-key"],
  supportsManagedEnvBackedApiKey: true,
  requiresManagedApiKeyShellEnvironment: true,
  supportedConnectionFamilyIds: [
    "openai-api-key",
    "anthropic-api-key",
    "openai-session",
    "openclaw-openai-session",
    "claude-session",
  ],
  autoSyncMatchedSelection: false,
  connectionEntryMode: "configure_or_import",
} as const satisfies AgentDeclarationDefinition;
