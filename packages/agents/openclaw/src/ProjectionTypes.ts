import type { EndpointAuthScheme, OpenAiWireApi } from "@nile/core/models/endpoint";
import type { AgentProjection } from "@nile/core/projection";

type OpenClawProjectionCommon = AgentProjection & {
  agentId: "openclaw";
  protocol: "openai" | "anthropic";
  authMode: "api_key" | "openai_session" | "openclaw_openai_session" | "claude_session";
  modelId: string;
};

export type OpenClawProviderProjection = OpenClawProjectionCommon & {
  configKind: "provider";
  authMode: "api_key";
  baseUrl: string;
  wireApi?: OpenAiWireApi;
  authScheme?: EndpointAuthScheme;
};

export type OpenClawAuthProfileProjection = OpenClawProjectionCommon & {
  configKind: "auth_profile";
  providerId: "openai" | "openai-codex" | "anthropic";
  profileMode: "api_key" | "oauth" | "token";
};

export type OpenClawProjection =
  | OpenClawProviderProjection
  | OpenClawAuthProfileProjection;
