import type { AccessRegistryInput, AuthMode } from "@nile/core/models/access";
import type { EndpointFamily, EndpointRegistryInput } from "@nile/core/models/endpoint";
import type { MatchedAgentConnection } from "@nile/core/models/agent/Adapter";
import { type CodexDetectedAccess, type CodexDetectedEndpoint } from "../types";
import type {
  ApiKeyCredential,
  OpenAiSessionCredential,
  StoredCredential,
} from "@nile/core/services/credential";

export type CodexEndpointFamily = Extract<EndpointFamily, "openai" | "gateway" | "azure-openai">;
export type CodexLiveCredential = ApiKeyCredential | OpenAiSessionCredential;

export type ParsedConfigState = {
  endpointId: string;
  modelId?: string;
  baseUrl?: string;
  wireApi?: string;
  envKey?: string;
};

export type ResolvedLiveState = {
  modelId?: string;
  endpoint: EndpointRegistryInput;
  access: Omit<AccessRegistryInput, "endpointId" | "id">;
  detectedEndpoint: CodexDetectedEndpoint;
  credential: StoredCredential;
  detectedAccess: CodexDetectedAccess;
};

export type ReadLiveSetupResult =
  | { kind: "resolved"; value: ResolvedLiveState }
  | { kind: "invalid_structure"; issues: string[] }
  | {
      kind: "invalid_semantics";
      issues: string[];
      endpoint: CodexDetectedEndpoint | null;
      access: CodexDetectedAccess | null;
    };

export type MatchLiveSetupResult = {
  matchedConnection: MatchedAgentConnection | null;
  validity: "valid_matched" | "valid_unverified" | "valid_import_candidate";
};
