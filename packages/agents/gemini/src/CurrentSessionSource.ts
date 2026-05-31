import type { CurrentSessionSourceManifest } from "@nile/core/session/Types";
import { resolveAgentHome } from "@nile/core/models/agent";
import { GeminiSessionStores } from "./Stores";
import { GeminiUnauthorizedUsageRecovery } from "./UnauthorizedUsageRecovery";

const unauthorizedUsageRecovery = new GeminiUnauthorizedUsageRecovery();

export const GEMINI_CURRENT_SESSION_SOURCE = {
  id: "current_gemini",
  familyId: "gemini-cli-session",
  authMode: "gemini_cli_session",
  label: "Current Gemini session",
  usageUnauthorizedRecovery: "sync_current_session_and_retry",
  recoverUnauthorizedUsage: async (context) => {
    const geminiHome = resolveAgentHome("gemini", context.agentHomes);
    await unauthorizedUsageRecovery.recover(geminiHome, context);
  },
  resolve: (context) => {
    const geminiHome = resolveAgentHome("gemini", context.agentHomes);
    const session = GeminiSessionStores.open(geminiHome).reader.read();
    if (session.kind !== "resolved") {
      throw new Error(`No Gemini CLI session found in current Gemini setup: ${session.issues.join("; ")}`);
    }

    return {
      kind: "gemini_cli_session",
      accessToken: session.value.credential.accessToken,
      refreshToken: session.value.credential.refreshToken,
      idToken: session.value.credential.idToken,
      ...(session.value.credential.expiryDate !== undefined ? { expiryDate: session.value.credential.expiryDate } : {}),
      ...(session.value.credential.tokenType ? { tokenType: session.value.credential.tokenType } : {}),
      ...(session.value.credential.scope ? { scope: session.value.credential.scope } : {}),
    };
  },
} as const satisfies CurrentSessionSourceManifest;
