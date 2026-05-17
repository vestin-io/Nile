import type { AccessRegistryInput } from "@nile/core/models/access";
import type { EndpointRegistryInput } from "@nile/core/models/endpoint";
import type { GeminiCliSessionCredential } from "@nile/core/services/credential";

export type ResolvedLiveState = {
  endpoint: EndpointRegistryInput;
  access: Omit<AccessRegistryInput, "endpointId" | "id">;
  detectedEndpoint: {
    endpointFamily: "gemini";
    endpointIdHint: "gemini";
    labelHint: string;
    baseUrl: string;
    wireApi?: undefined;
    envKey?: undefined;
  };
  credential: GeminiCliSessionCredential;
  detectedAccess: {
    authMode: "gemini_cli_session";
    labelHint: string;
    identityKey: string;
  };
};

export type ReadLiveSetupResult =
  | { kind: "resolved"; value: ResolvedLiveState }
  | { kind: "invalid_structure"; issues: string[] }
  | { kind: "invalid_semantics"; issues: string[] };
