import type { AuthMode } from "../../access/AuthMode";
import type { ConnectionPresetFamily } from "../preset";
import type { CurrentSessionSourceId } from "../SourceTypes";
import type { ConnectionFamilyId, ConnectionFamilyProtocolKey } from "./Types";

export type ConnectionFamilyManifestDefinition = {
  id: ConnectionFamilyId;
  authMode: AuthMode;
  protocol: ConnectionFamilyProtocolKey;
  selectablePresets: readonly ConnectionPresetFamily[];
  currentSessionSourceIds: readonly CurrentSessionSourceId[];
};
