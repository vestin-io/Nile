import type { ConnectionFamilyManifestDefinition } from "@nile/core/models/connection/family";

export const ANTHROPIC_API_KEY_MANIFEST = {
  id: "anthropic-api-key",
  authMode: "api_key",
  protocol: "anthropic",
  selectablePresets: ["anthropic", "gateway"],
  currentSessionSourceIds: [],
} as const satisfies ConnectionFamilyManifestDefinition;
