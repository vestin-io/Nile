import type { AgentId } from "../../models/agent/Types";
import type { EndpointFamily } from "../../models/endpoint";
import type { AuthMode } from "../../models/access";
import type { AgentLiveStateValidity, MatchedAgentConnection } from "../../models/agent";

export const OPENCLAW_AGENT_ID: AgentId = "openclaw";

export type OpenClawDetectedEndpoint = {
  endpointFamily: Extract<EndpointFamily, "openai" | "gateway" | "azure-openai" | "anthropic">;
  endpointIdHint: string;
  labelHint: string;
  baseUrl?: string;
  wireApi?: "chat" | "responses";
};

export type OpenClawDetectedAccess = {
  authMode: Extract<AuthMode, "api_key" | "openai_session" | "claude_session">;
  labelHint: string;
  openclawModelId: string;
  identityKey?: string;
};

export type OpenClawDetectedCurrentState = {
  agentId: AgentId;
  validity: AgentLiveStateValidity;
  issues: string[];
  endpoint: OpenClawDetectedEndpoint | null;
  access: OpenClawDetectedAccess | null;
  matchedConnection: MatchedAgentConnection | null;
};
