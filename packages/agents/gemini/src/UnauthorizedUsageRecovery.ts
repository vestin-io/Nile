import type { CurrentSessionResolveContext } from "@nile/core/session/Types";

import { GEMINI_AGENT_ID } from "./types";
import { GeminiSessionRefresh } from "./SessionRefresh";
import { GeminiSignInFlow } from "./SignInFlow";

export class GeminiUnauthorizedUsageRecovery {
  constructor(
    private readonly sessionRefresh: GeminiSessionRefresh = new GeminiSessionRefresh(),
    private readonly createSignInFlow: (context: CurrentSessionResolveContext) => GeminiSignInFlow =
      (context) => new GeminiSignInFlow(context.environment),
  ) {}

  async recover(geminiHome: string, context: CurrentSessionResolveContext): Promise<void> {
    try {
      await this.sessionRefresh.refresh(geminiHome, context.environment);
      return;
    } catch (error) {
      if (!this.shouldRetryWithLogin(error)) {
        throw error;
      }
    }

    await this.createSignInFlow(context).signInAndRead(geminiHome, {
      commandPathOverride: context.agentRuntimeCommandOverrides?.[GEMINI_AGENT_ID],
    });
  }

  private shouldRetryWithLogin(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /Opening authentication page in your browser/i.test(message)
      || /Do you want to continue\?/i.test(message)
      || /invalid_grant/i.test(message)
      || /refresh token.+(?:expired|revoked|invalid)/i.test(message);
  }
}
