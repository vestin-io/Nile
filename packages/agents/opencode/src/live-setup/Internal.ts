import type { AccessRegistryInput } from "@nile/core/models/access";
import type { EndpointRegistryInput } from "@nile/core/models/endpoint";
import type { StoredCredential } from "@nile/core/services/credential";
import type { OpenCodeDetectedAccess, OpenCodeDetectedEndpoint } from "../types";

export type ResolvedLiveState = {
  modelId?: string;
  endpoint: EndpointRegistryInput;
  access: Omit<AccessRegistryInput, "endpointId" | "id">;
  detectedEndpoint: OpenCodeDetectedEndpoint;
  credential: StoredCredential;
  detectedAccess: OpenCodeDetectedAccess;
};

export type ReadLiveSetupResult =
  | { kind: "resolved"; value: ResolvedLiveState }
  | { kind: "invalid_structure"; issues: string[] }
  | {
      kind: "invalid_semantics";
      issues: string[];
      endpoint: OpenCodeDetectedEndpoint | null;
      access: OpenCodeDetectedAccess | null;
    };
