import type { AgentId } from "@nile/core/models/agent";
import type { AgentLiveStateValidity, MatchedAgentConnection } from "@nile/core/models/agent/Adapter";
import type { EndpointFamily } from "@nile/core/models/endpoint";

export const OPENCODE_AGENT_ID: AgentId = "opencode";

export type OpenCodeDetectedEndpoint = {
  endpointFamily: Extract<EndpointFamily, "openai" | "gateway" | "azure-openai" | "anthropic">;
  endpointIdHint: string;
  labelHint: string;
  baseUrl?: string;
  wireApi?: "chat" | "responses";
  envKey?: string;
};

export type OpenCodeDetectedAccess = {
  authMode: "api_key" | "openai_session";
  labelHint: string;
  identityKey?: string;
};

export type OpenCodeDetectedLiveSetup = {
  agentId: AgentId;
  validity: AgentLiveStateValidity;
  issues: string[];
  endpoint: OpenCodeDetectedEndpoint | null;
  access: OpenCodeDetectedAccess | null;
  modelId?: string;
  matchedConnection: MatchedAgentConnection | null;
};
