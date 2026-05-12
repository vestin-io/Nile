import type { AgentId } from "../../models/agent/Types";
import type { EndpointFamily } from "../../models/endpoint";
import type { AgentLiveStateValidity, MatchedAgentConnection } from "../../models/agent";

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
