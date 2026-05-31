import type { CurrentSessionResolveContext } from "@nile/core/session/Types";

import { CODEX_AGENT_ID } from "./types";
import { CodexSessionLogin } from "./CodexSessionLogin";

export class CodexUnauthorizedUsageRecovery {
  constructor(
    private readonly createLogin: (context: CurrentSessionResolveContext) => CodexSessionLogin =
      (context) => new CodexSessionLogin(context.environment),
  ) {}

  async recover(codexHome: string, context: CurrentSessionResolveContext): Promise<void> {
    await this.createLogin(context).signInAndRead(codexHome, {
      commandPathOverride: context.agentRuntimeCommandOverrides?.[CODEX_AGENT_ID],
      openExternalUrl: context.openExternalUrl,
    });
  }
}
