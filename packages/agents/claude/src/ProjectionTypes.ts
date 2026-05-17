import type { EndpointAuthScheme } from "@nile/core/models/endpoint";
import type { AgentProjection } from "@nile/core/projection";

export type ClaudeProjection = AgentProjection & {
  agentId: "claude";
  protocol: "anthropic";
  authMode: "api_key" | "claude_session";
  authScheme?: EndpointAuthScheme;
  baseUrl: string;
  envKey?: string;
};
