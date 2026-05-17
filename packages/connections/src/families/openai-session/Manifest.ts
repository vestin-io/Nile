import type { ConnectionFamilyManifestDefinition } from "@nile/core/models/connection/family";

export const OPENAI_SESSION_MANIFEST = {
  id: "openai-session",
  authMode: "openai_session",
  protocol: "openai",
  selectablePresets: ["openai"],
  currentSessionSourceIds: ["current_codex"],
} as const satisfies ConnectionFamilyManifestDefinition;
