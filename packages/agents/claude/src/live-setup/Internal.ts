import type { AccessRegistryInput } from "@nile/core/models/access";
import type { EndpointRegistryInput } from "@nile/core/models/endpoint";
import type { AuthMode } from "@nile/core/models/access";
import type { StoredCredential } from "@nile/core/services/credential";
import type { MatchedAgentConnection } from "@nile/core/models/agent/Adapter";
import type { ClaudeDetectedAccess, ClaudeDetectedEndpoint } from "../types";

export type ResolvedLiveState = {
  modelId?: string;
  endpoint: EndpointRegistryInput;
  access: Omit<AccessRegistryInput, "endpointId" | "id">;
  detectedEndpoint: ClaudeDetectedEndpoint;
  credential: StoredCredential;
  detectedAccess: ClaudeDetectedAccess;
};

export type ReadLiveSetupResult =
  | { kind: "resolved"; value: ResolvedLiveState }
  | { kind: "invalid_structure"; issues: string[] }
  | {
      kind: "invalid_semantics";
      issues: string[];
      endpoint: ClaudeDetectedEndpoint | null;
      access: ClaudeDetectedAccess | null;
    };

export type MatchLiveSetupResult = {
  matchedConnection: MatchedAgentConnection | null;
  validity: "valid_matched" | "valid_unverified" | "valid_import_candidate";
};
