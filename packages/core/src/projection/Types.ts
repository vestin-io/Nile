import type { AgentId } from "../models/agent/Types";
import type { AccessRecord } from "../models/access";
import type { EndpointAuthScheme, EndpointRecord, OpenAiWireApi } from "../models/endpoint";
import type { StoredCredential } from "../services/credential/Types";

export type ProjectionInput = {
  endpoint: EndpointRecord;
  access: AccessRecord;
  credential: StoredCredential;
};

type ProjectionCommon = {
  agentId: AgentId;
  endpointId: string;
  endpointLabel: string;
  accessId: string;
  accessLabel: string;
};

export type CodexProjection = ProjectionCommon & {
  agentId: "codex";
  protocol: "openai";
  authMode: "api_key" | "openai_session";
  authScheme: "bearer";
  baseUrl: string;
  wireApi: OpenAiWireApi;
  envKey?: string;
};

export type ClaudeProjection = ProjectionCommon & {
  agentId: "claude";
  protocol: "anthropic";
  authMode: "api_key" | "claude_session";
  authScheme?: EndpointAuthScheme;
  baseUrl: string;
  envKey?: string;
};

export type CursorProjection = ProjectionCommon & {
  agentId: "cursor";
  protocol: "cursor";
  authMode: "api_key" | "cursor_session";
  backendUrl: string;
};

type OpenClawProjectionCommon = ProjectionCommon & {
  agentId: "openclaw";
  protocol: "openai" | "anthropic";
  authMode: "api_key" | "openai_session" | "claude_session";
  modelId: string;
};

export type OpenClawProviderProjection = OpenClawProjectionCommon & {
  configKind: "provider";
  authMode: "api_key";
  baseUrl: string;
  wireApi?: OpenAiWireApi;
  authScheme?: EndpointAuthScheme;
};

export type OpenClawAuthProfileProjection = OpenClawProjectionCommon & {
  configKind: "auth_profile";
  providerId: "openai" | "openai-codex" | "anthropic";
  profileMode: "api_key" | "oauth" | "token";
};

export type OpenClawProjection =
  | OpenClawProviderProjection
  | OpenClawAuthProfileProjection;

export type AgentProjection =
  | CodexProjection
  | ClaudeProjection
  | CursorProjection
  | OpenClawProjection;
