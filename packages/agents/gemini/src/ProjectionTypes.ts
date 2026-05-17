import type { AgentProjection } from "@nile/core/projection";

export type GeminiProjection = AgentProjection & {
  agentId: "gemini";
  protocol: "gemini";
  authMode: "gemini_cli_session";
  selectedAuthType: "oauth-personal";
};
