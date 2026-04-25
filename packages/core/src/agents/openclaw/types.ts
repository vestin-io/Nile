import type { AgentId } from "../../models/agent/Types";
import type { EndpointFamily } from "../../models/endpoint";
import type {
  AgentLiveStateValidity,
  MatchedAgentConnection,
} from "../../runtime-local/AgentAdapterTypes";

export const OPENCLAW_AGENT_ID: AgentId = "openclaw";

export type OpenClawDetectedEndpoint = {
  endpointFamily: Extract<EndpointFamily, "openai" | "gateway" | "azure-openai" | "anthropic">;
  endpointIdHint: string;
  labelHint: string;
  baseUrl?: string;
  wireApi?: "chat" | "responses";
};

export type OpenClawDetectedAccess = {
  authMode: "api_key";
  labelHint: string;
  openclawModelId: string;
};

export type OpenClawDetectedCurrentState = {
  agentId: AgentId;
  validity: AgentLiveStateValidity;
  issues: string[];
  endpoint: OpenClawDetectedEndpoint | null;
  access: OpenClawDetectedAccess | null;
  matchedConnection: MatchedAgentConnection | null;
};
