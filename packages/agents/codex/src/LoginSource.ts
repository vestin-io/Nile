import type { InteractiveSessionLoginManifest } from "@nile/core/session/LoginTypes";
import { resolveAgentHome } from "@nile/core/models/agent/homes";
import { CodexSessionLogin } from "./CodexSessionLogin";
import { CodexCurrentCredentialReader } from "./live-setup/CurrentCredentialReader";

export const CODEX_LOGIN_SOURCE = {
  authMode: "openai_session",
  label: "Sign in with Codex",
  async signInAndRead(context, request) {
    const codexHome = resolveAgentHome("codex", context.agentHomes);
    const login = new CodexSessionLogin(context.environment);
    await login.signIn(codexHome);
    const authJsonPath = request.authMode === "openai_session" ? request.authJsonPath : undefined;
    const credential = CodexCurrentCredentialReader.open({
      codexHome,
      ...(authJsonPath?.trim() ? { authPath: authJsonPath.trim() } : {}),
    }).read();
    if (credential.kind !== "openai_session") {
      throw new Error("No OpenAI session found after Codex sign-in");
    }
    return credential;
  },
} as const satisfies InteractiveSessionLoginManifest;
