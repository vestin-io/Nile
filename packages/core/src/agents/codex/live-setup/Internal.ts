import type { AccessRegistryInput } from "../../../models/access";
import type { EndpointFamily, EndpointRegistryInput } from "../../../models/endpoint";
import type { AuthMode } from "../../../models/access";
import type { MatchedAgentConnection } from "../../../models/agent";
import { type CodexDetectedAccess, type CodexDetectedEndpoint } from "../types";
import type {
  ApiKeyCredential,
  OpenAiSessionCredential,
  StoredCredential,
} from "../../../services/credential/Types";

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
