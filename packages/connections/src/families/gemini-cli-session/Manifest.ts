import type { ConnectionFamilyManifestDefinition } from "@nile/core/models/connection/family";

export const GEMINI_CLI_SESSION_MANIFEST = {
  id: "gemini-cli-session",
  authMode: "gemini_cli_session",
  protocol: "gemini",
  selectablePresets: ["gemini"],
  currentSessionSourceIds: ["current_gemini"],
} as const satisfies ConnectionFamilyManifestDefinition;
