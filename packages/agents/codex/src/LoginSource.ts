import type { InteractiveSessionLoginManifest } from "@nile/core/session/LoginTypes";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodexSessionLogin } from "./CodexSessionLogin";

export const CODEX_LOGIN_SOURCE = {
  authMode: "openai_session",
  label: "Sign in with Codex",
  async signInAndRead(context) {
    const { loginRoot, codexHome } = createTemporaryCodexHome();
    const login = new CodexSessionLogin(context.environment);
    try {
      const credential = await login.signInAndRead(codexHome);
      if (credential.kind !== "openai_session") {
        throw new Error("No OpenAI session found after Codex sign-in");
      }
      return credential;
    } finally {
      rmSync(loginRoot, { recursive: true, force: true });
    }
  },
} as const satisfies InteractiveSessionLoginManifest;

function createTemporaryCodexHome(): { loginRoot: string; codexHome: string } {
  const loginRoot = mkdtempSync(join(tmpdir(), "nile-codex-login-"));
  const codexHome = join(loginRoot, ".codex");
  mkdirSync(codexHome, { recursive: true });
  return { loginRoot, codexHome };
}
