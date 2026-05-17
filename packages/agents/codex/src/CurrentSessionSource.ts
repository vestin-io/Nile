import type { CurrentSessionSourceManifest } from "@nile/core/session/Types";
import { resolveAgentHome } from "@nile/core/models/agent/homes";
import { CodexCurrentCredentialReader } from "./live-setup/CurrentCredentialReader";

export const CODEX_CURRENT_SESSION_SOURCE = {
  id: "current_codex",
  familyId: "openai-session",
  authMode: "openai_session",
  label: "Current Codex session",
  resolve: (context, request) => {
    const codexHome = resolveAgentHome("codex", context.agentHomes);
    const credential = CodexCurrentCredentialReader.open({
      codexHome,
      authPath: request.authJsonPath?.trim() || undefined,
    }).read();
    if (credential.kind !== "openai_session") {
      throw new Error("No OpenAI session found in current Codex setup");
    }
    return credential;
  },
} as const satisfies CurrentSessionSourceManifest;
