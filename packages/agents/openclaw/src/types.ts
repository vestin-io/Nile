import type { AgentId } from "@nile/core/models/agent";
import type { EndpointFamily } from "@nile/core/models/endpoint";
import type { AuthMode } from "@nile/core/models/access";
import type { AgentLiveStateValidity, MatchedAgentConnection } from "@nile/core/models/agent/Adapter";

export const OPENCLAW_AGENT_ID: AgentId = "openclaw";

export type OpenClawDetectedEndpoint = {
  endpointFamily: Extract<EndpointFamily, "openai" | "gateway" | "azure-openai" | "anthropic">;
  endpointIdHint: string;
  labelHint: string;
  baseUrl?: string;
  wireApi?: "chat" | "responses";
};

export type OpenClawDetectedAccess = {
  authMode: Extract<AuthMode, "api_key" | "openai_session" | "openclaw_openai_session" | "claude_session">;
  labelHint: string;
  identityKey?: string;
};

export type OpenClawDetectedLiveSetup = {
  agentId: AgentId;
  validity: AgentLiveStateValidity;
  issues: string[];
  endpoint: OpenClawDetectedEndpoint | null;
  access: OpenClawDetectedAccess | null;
  modelId?: string;
  matchedConnection: MatchedAgentConnection | null;
};
