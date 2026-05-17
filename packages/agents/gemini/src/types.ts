import type { AgentId } from "@nile/core/models/agent/ids";
import type { EndpointFamily } from "@nile/core/models/endpoint";
import type { AgentLiveStateValidity, MatchedAgentConnection } from "@nile/core/models/agent/Adapter";

export const GEMINI_AGENT_ID = "gemini" as AgentId;

export const GEMINI_AUTH_TYPE_OAUTH_PERSONAL = "oauth-personal";
export const GEMINI_KEYCHAIN_SERVICE = "gemini-cli-oauth";
export const GEMINI_KEYCHAIN_ACCOUNT = "main-account";

export type GeminiLocalSessionCredential = {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiryDate?: number;
  tokenType?: string;
  scope?: string;
};

export type GeminiGoogleAccountsState = {
  active: string | null;
  old: string[];
};

export type GeminiCredentialBackendKind = "keychain" | "file";

export type GeminiCredentialBackendSnapshot = {
  keychain: string | null;
  file: string | null;
};

export type GeminiCurrentSessionState = {
  selectedAuthType: typeof GEMINI_AUTH_TYPE_OAUTH_PERSONAL;
  backendKind: GeminiCredentialBackendKind;
  credential: GeminiLocalSessionCredential;
  activeEmail: string;
  credentialEmail: string | null;
  credentialSubject: string | null;
  identityKey: string;
  labelHint: string;
  issues: string[];
};

export type GeminiReadSessionResult =
  | { kind: "resolved"; value: GeminiCurrentSessionState }
  | { kind: "invalid_structure"; issues: string[] }
  | { kind: "invalid_semantics"; issues: string[] };

export type GeminiDetectedEndpoint = {
  endpointFamily: Extract<EndpointFamily, "gemini">;
  endpointIdHint: string;
  labelHint: string;
  baseUrl?: string;
};

export type GeminiDetectedAccess = {
  authMode: "gemini_cli_session";
  labelHint: string;
  identityKey?: string;
};

export type GeminiDetectedLiveSetup = {
  agentId: AgentId;
  validity: AgentLiveStateValidity;
  issues: string[];
  endpoint: GeminiDetectedEndpoint | null;
  access: GeminiDetectedAccess | null;
  matchedConnection: MatchedAgentConnection | null;
};
