import type { ConnectionFamilyManifestDefinition } from "@nile/core/models/connection/family";

export const CLAUDE_SESSION_MANIFEST = {
  id: "claude-session",
  authMode: "claude_session",
  protocol: "anthropic",
  selectablePresets: ["anthropic"],
  currentSessionSourceIds: ["current_claude"],
} as const satisfies ConnectionFamilyManifestDefinition;
