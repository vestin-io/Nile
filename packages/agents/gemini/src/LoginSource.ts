import type { InteractiveSessionLoginManifest } from "@nile/core/session/LoginTypes";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GEMINI_LOGIN_DECLARATION } from "./LoginDeclaration";
import { GeminiSignInFlow } from "./SignInFlow";
import { GEMINI_AGENT_ID } from "./types";

export const GEMINI_LOGIN_SOURCE = {
  ...GEMINI_LOGIN_DECLARATION,
  async signInAndRead(context) {
    const geminiHome = createTemporaryGeminiHome();
    return await new GeminiSignInFlow(context.environment).signInAndRead(geminiHome, {
      commandPathOverride: context.agentRuntimeCommandOverrides?.[GEMINI_AGENT_ID],
    });
  },
} as const satisfies InteractiveSessionLoginManifest;

function createTemporaryGeminiHome(): string {
  const loginRoot = mkdtempSync(join(tmpdir(), "nile-gemini-login-"));
  const geminiHome = join(loginRoot, ".gemini");
  mkdirSync(geminiHome, { recursive: true });
  return geminiHome;
}
