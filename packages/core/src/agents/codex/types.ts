import type { AgentId } from "../../models/agent/Types";
import type { EndpointFamily } from "../../models/endpoint";
import type { AgentLiveStateValidity, MatchedAgentConnection } from "../../models/agent";

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
