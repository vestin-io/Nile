import type { EndpointAuthScheme, OpenAiWireApi } from "@nile/core/models/endpoint";
import type { AgentProjection } from "@nile/core/projection";

export type OpenCodeProviderPackage =
  | "@ai-sdk/openai"
  | "@ai-sdk/openai-compatible"
  | "@ai-sdk/anthropic";

export type OpenCodeApiKeyProjection = AgentProjection & {
  agentId: "opencode";
  protocol: "openai" | "anthropic";
  authMode: "api_key";
  providerPackage: OpenCodeProviderPackage;
  modelId: string;
  baseUrl?: string;
  wireApi?: OpenAiWireApi;
  authScheme?: Extract<EndpointAuthScheme, "x_api_key" | "bearer">;
  versionHeader?: string;
};

export type OpenCodeOpenAiSessionProjection = AgentProjection & {
  agentId: "opencode";
  protocol: "openai";
  authMode: "openai_session";
  modelId: string;
  wireApi: "responses";
};

export type OpenCodeProjection =
  | OpenCodeApiKeyProjection
  | OpenCodeOpenAiSessionProjection;
