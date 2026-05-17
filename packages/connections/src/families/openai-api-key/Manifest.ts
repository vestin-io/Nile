import type { ConnectionFamilyManifestDefinition } from "@nile/core/models/connection/family";

export const OPENAI_API_KEY_MANIFEST = {
  id: "openai-api-key",
  authMode: "api_key",
  protocol: "openai",
  selectablePresets: ["openai", "azure-openai", "gateway"],
  currentSessionSourceIds: [],
} as const satisfies ConnectionFamilyManifestDefinition;
