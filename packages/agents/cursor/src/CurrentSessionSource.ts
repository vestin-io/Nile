import type { CurrentSessionSourceManifest } from "@nile/core/session/Types";
import { resolveAgentHome } from "@nile/core/models/agent";
import { CurrentCredentialReader } from "./live-setup/CredentialReader";

export const CURSOR_CURRENT_SESSION_SOURCE = {
  id: "current_cursor",
  familyId: "cursor-session",
  authMode: "cursor_session",
  label: "Current Cursor session",
  resolve: (context) => {
    const cursorHome = resolveAgentHome("cursor", context.agentHomes);
    const credential = CurrentCredentialReader.open({
      cursorHome,
      environment: context.environment,
    }).read();
    if (credential.kind !== "cursor_session") {
      throw new Error("No Cursor session found in current Cursor setup");
    }
    return credential;
  },
} as const satisfies CurrentSessionSourceManifest;
