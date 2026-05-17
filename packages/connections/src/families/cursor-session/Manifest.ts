import type { ConnectionFamilyManifestDefinition } from "@nile/core/models/connection/family";

export const CURSOR_SESSION_MANIFEST = {
  id: "cursor-session",
  authMode: "cursor_session",
  protocol: "cursor",
  selectablePresets: ["gateway", "cursor"],
  currentSessionSourceIds: ["current_cursor"],
} as const satisfies ConnectionFamilyManifestDefinition;
