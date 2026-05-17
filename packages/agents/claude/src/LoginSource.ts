import type { InteractiveSessionLoginManifest } from "@nile/core/session/LoginTypes";
import { resolveAgentHome } from "@nile/core/models/agent/homes";
import { ClaudeSessionLogin } from "./ClaudeSessionLogin";
import { CurrentCredentialReader } from "./live-setup/CredentialReader";
import { CLAUDE_LOGIN_DECLARATION } from "./LoginDeclaration";

export const CLAUDE_LOGIN_SOURCE = {
  ...CLAUDE_LOGIN_DECLARATION,
  async signInAndRead(context) {
    const claudeHome = resolveAgentHome("claude", context.agentHomes);
    const login = new ClaudeSessionLogin(context.environment);
    await login.signIn(claudeHome);
    return CurrentCredentialReader.open({ claudeHome }).readSession();
  },
} as const satisfies InteractiveSessionLoginManifest;
