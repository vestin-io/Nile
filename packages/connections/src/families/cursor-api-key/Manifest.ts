import type { ConnectionFamilyManifestDefinition } from "@nile/core/models/connection/family";

export const CURSOR_API_KEY_MANIFEST = {
  id: "cursor-api-key",
  authMode: "api_key",
  protocol: "cursor",
  selectablePresets: ["gateway"],
  currentSessionSourceIds: [],
} as const satisfies ConnectionFamilyManifestDefinition;
