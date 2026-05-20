import type { InteractiveSessionLoginManifest } from "@nile/core/session/LoginTypes";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClaudeSessionLogin } from "./ClaudeSessionLogin";
import { CLAUDE_LOGIN_DECLARATION } from "./LoginDeclaration";
import { CLAUDE_AGENT_ID } from "./types";

export const CLAUDE_LOGIN_SOURCE = {
  ...CLAUDE_LOGIN_DECLARATION,
  async signInAndRead(context) {
    const { loginRoot, claudeHome } = createTemporaryClaudeHome();
    const login = new ClaudeSessionLogin(context.environment);
    try {
      const credential = await login.signInAndRead(claudeHome, {
        commandPathOverride: context.agentRuntimeCommandOverrides?.[CLAUDE_AGENT_ID],
      });
      if (credential.kind !== "claude_session") {
        throw new Error("No Claude session found after Claude sign-in");
      }
      return credential;
    } finally {
      rmSync(loginRoot, { recursive: true, force: true });
    }
  },
} as const satisfies InteractiveSessionLoginManifest;

function createTemporaryClaudeHome(): { loginRoot: string; claudeHome: string } {
  const loginRoot = mkdtempSync(join(tmpdir(), "nile-claude-login-"));
  const claudeHome = join(loginRoot, ".claude");
  mkdirSync(claudeHome, { recursive: true });
  return { loginRoot, claudeHome };
}
