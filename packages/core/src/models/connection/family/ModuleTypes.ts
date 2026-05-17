import type { ConnectionFamilyManifestDefinition } from "./ManifestTypes";
import type { ConnectionFamilyBehaviorSet } from "./BehaviorTypes";

export type ConnectionFamilyModule = {
  manifest: ConnectionFamilyManifestDefinition;
  behaviors: ConnectionFamilyBehaviorSet;
};
