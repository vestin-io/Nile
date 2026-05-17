import type { AgentId } from "@nile/core/models/agent/ids";
import type { EndpointFamily } from "@nile/core/models/endpoint";
import type { AgentLiveStateValidity, MatchedAgentConnection } from "@nile/core/models/agent/Adapter";

export const CODEX_AGENT_ID: AgentId = "codex";

export type CodexDetectedEndpoint = {
  endpointFamily: Extract<EndpointFamily, "openai" | "gateway" | "azure-openai">;
  endpointIdHint: string;
  labelHint: string;
  baseUrl?: string;
  wireApi?: string;
  envKey?: string;
};

export type CodexDetectedAccess = {
  authMode: "api_key" | "openai_session";
  labelHint: string;
  identityKey?: string;
};

export type CodexDetectedLiveSetup = {
  agentId: AgentId;
  validity: AgentLiveStateValidity;
  issues: string[];
  endpoint: CodexDetectedEndpoint | null;
  access: CodexDetectedAccess | null;
  matchedConnection: MatchedAgentConnection | null;
};
