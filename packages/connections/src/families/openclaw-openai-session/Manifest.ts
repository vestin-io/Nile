import type { ConnectionFamilyManifestDefinition } from "@nile/core/models/connection/family";

export const OPENCLAW_OPENAI_SESSION_MANIFEST = {
  id: "openclaw-openai-session",
  authMode: "openclaw_openai_session",
  protocol: "openai",
  selectablePresets: [],
  currentSessionSourceIds: [],
} as const satisfies ConnectionFamilyManifestDefinition;
