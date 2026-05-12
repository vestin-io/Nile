import type { AccessRegistryInput } from "../../../models/access";
import type { EndpointRegistryInput } from "../../../models/endpoint";
import type { OpenClawDetectedAccess, OpenClawDetectedEndpoint } from "../types";
import type { StoredCredential } from "../../../services/credential/Types";

export type ResolvedLiveState = {
  modelId?: string;
  endpoint: EndpointRegistryInput;
  access: Omit<AccessRegistryInput, "endpointId" | "id">;
  detectedEndpoint: OpenClawDetectedEndpoint;
  credential: StoredCredential;
  detectedAccess: OpenClawDetectedAccess;
};

export type ReadLiveSetupResult =
  | { kind: "resolved"; value: ResolvedLiveState }
  | { kind: "invalid_structure"; issues: string[] }
  | {
      kind: "invalid_semantics";
      issues: string[];
      endpoint: OpenClawDetectedEndpoint | null;
      access: OpenClawDetectedAccess | null;
    };
