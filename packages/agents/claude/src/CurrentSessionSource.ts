import type { CurrentSessionSourceManifest } from "@nile/core/session/Types";
import { resolveAgentHome } from "@nile/core/models/agent/homes";
import { CurrentCredentialReader } from "./live-setup/CredentialReader";

export const CLAUDE_CURRENT_SESSION_SOURCE = {
  id: "current_claude",
  familyId: "claude-session",
  authMode: "claude_session",
  label: "Current Claude session",
  resolve: (context) => {
    const claudeHome = resolveAgentHome("claude", context.agentHomes);
    const credential = CurrentCredentialReader.open({ claudeHome }).read();
    if (credential.kind !== "claude_session") {
      throw new Error("No Claude session found in current Claude setup");
    }
    return credential;
  },
} as const satisfies CurrentSessionSourceManifest;
