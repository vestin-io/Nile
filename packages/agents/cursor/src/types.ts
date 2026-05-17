import type { AgentId } from "@nile/core/models/agent/ids";
import type { EndpointFamily } from "@nile/core/models/endpoint";
import type { AgentLiveStateValidity, MatchedAgentConnection } from "@nile/core/models/agent/Adapter";

export const CURSOR_AGENT_ID: AgentId = "cursor";

export type CursorLiveCredentialSnapshot = {
  accessToken: string | null;
  refreshToken: string | null;
  apiKey: string | null;
};

export type CursorAuthInfo = {
  email?: string;
  displayName?: string;
  userId?: number;
  authId?: string;
};

export type CursorConfigState = {
  backendUrl: string;
  authCacheKey?: string;
  authInfo?: CursorAuthInfo;
};

export type CursorDetectedEndpoint = {
  endpointFamily: Extract<EndpointFamily, "cursor">;
  endpointIdHint: string;
  labelHint: string;
  baseUrl?: string;
  envKey?: string;
};

export type CursorDetectedAccess = {
  authMode: "api_key" | "cursor_session";
  labelHint: string;
  identityKey?: string;
};

export type CursorDetectedLiveSetup = {
  agentId: AgentId;
  validity: AgentLiveStateValidity;
  issues: string[];
  endpoint: CursorDetectedEndpoint | null;
  access: CursorDetectedAccess | null;
  matchedConnection: MatchedAgentConnection | null;
};
