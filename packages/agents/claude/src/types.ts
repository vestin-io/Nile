import type { AgentId } from "@nile/core/models/agent/ids";
import type { EndpointFamily } from "@nile/core/models/endpoint";
import type { AgentLiveStateValidity, MatchedAgentConnection } from "@nile/core/models/agent/Adapter";

export const CLAUDE_AGENT_ID: AgentId = "claude";

export type ClaudeDetectedEndpoint = {
  endpointFamily: Extract<EndpointFamily, "anthropic">;
  endpointIdHint: string;
  labelHint: string;
  baseUrl?: string;
  envKey?: string;
};

export type ClaudeDetectedAccess = {
  authMode: "api_key" | "claude_session";
  labelHint: string;
  identityKey?: string;
};

export type ClaudeDetectedLiveSetup = {
  agentId: AgentId;
  validity: AgentLiveStateValidity;
  issues: string[];
  endpoint: ClaudeDetectedEndpoint | null;
  access: ClaudeDetectedAccess | null;
  matchedConnection: MatchedAgentConnection | null;
};
