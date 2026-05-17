import type { OpenAiWireApi } from "@nile/core/models/endpoint";
import type { AgentProjection } from "@nile/core/projection";

export type CodexProjection = AgentProjection & {
  agentId: "codex";
  protocol: "openai";
  authMode: "api_key" | "openai_session";
  authScheme: "bearer";
  baseUrl: string;
  wireApi: OpenAiWireApi;
  envKey?: string;
};
