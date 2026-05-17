import type { AuthMode } from "../access";
import type { EndpointProtocols } from "../endpoint";
export type { ConnectionPresetFamily } from "./preset";
import type { ConnectionPresetFamily } from "./preset";
import {
  CONNECTION_FAMILY_REGISTRY,
} from "./family";
import type { ConnectionFamilyId } from "./family";

export type ConnectionSupportKind = ConnectionFamilyId;

type ConnectionSupportProtocols = Pick<EndpointProtocols, "openai" | "anthropic" | "cursor" | "gemini">;

type ReadSavedKindsInput = {
  protocols: ConnectionSupportProtocols;
  authMode: AuthMode;
};

type ReadSelectableKindsInput = {
  preset: ConnectionPresetFamily;
  authMode: AuthMode;
};

export class ConnectionSupportKinds {
  readDetectedApiKeyKinds(protocols: ConnectionSupportProtocols): ConnectionSupportKind[] {
    return CONNECTION_FAMILY_REGISTRY.readDetectedApiKeyFamilyIds(protocols);
  }

  readSavedKinds(input: ReadSavedKindsInput): ConnectionSupportKind[] {
    return CONNECTION_FAMILY_REGISTRY.readSavedFamilyIds(input);
  }

  readSelectableKinds(input: ReadSelectableKindsInput): ConnectionSupportKind[] {
    return CONNECTION_FAMILY_REGISTRY.readSelectableFamilyIds(input);
  }
}

export const CONNECTION_SUPPORT_KINDS = new ConnectionSupportKinds();
