import type { CurrentSessionSourceManifest } from "@nile/core/session/Types";
import { resolveAgentHome } from "@nile/core/models/agent";
import { CodexCurrentCredentialReader } from "./live-setup/CurrentCredentialReader";
import { CodexUnauthorizedUsageRecovery } from "./UnauthorizedUsageRecovery";

const unauthorizedUsageRecovery = new CodexUnauthorizedUsageRecovery();

export const CODEX_CURRENT_SESSION_SOURCE = {
  id: "current_codex",
  familyId: "openai-session",
  authMode: "openai_session",
  label: "Current Codex session",
  usageUnauthorizedRecovery: "sync_current_session_and_retry",
  recoverUnauthorizedUsage: async (context) => {
    const codexHome = resolveAgentHome("codex", context.agentHomes);
    await unauthorizedUsageRecovery.recover(codexHome, context);
  },
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
