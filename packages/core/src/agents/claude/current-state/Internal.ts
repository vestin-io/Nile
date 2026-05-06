import type { AccessRegistryInput } from "../../../models/access";
import type { EndpointRegistryInput } from "../../../models/endpoint";
import type { AuthMode } from "../../../models/access";
import type { StoredCredential } from "../../../services/credential/Types";
import type { MatchedAgentConnection } from "../../../models/agent";
import type { ClaudeDetectedAccess, ClaudeDetectedEndpoint } from "../types";

export type ResolvedLiveState = {
  endpoint: EndpointRegistryInput;
  access: Omit<AccessRegistryInput, "endpointId" | "id">;
  detectedEndpoint: ClaudeDetectedEndpoint;
  credential: StoredCredential;
  detectedAccess: ClaudeDetectedAccess;
};

export type ReadCurrentStateResult =
  | { kind: "resolved"; value: ResolvedLiveState }
  | { kind: "invalid_structure"; issues: string[] }
  | {
      kind: "invalid_semantics";
      issues: string[];
      endpoint: ClaudeDetectedEndpoint | null;
      access: ClaudeDetectedAccess | null;
    };

export type MatchCurrentStateResult = {
  matchedConnection: MatchedAgentConnection | null;
  validity: "valid_matched" | "valid_unverified" | "valid_import_candidate";
};
