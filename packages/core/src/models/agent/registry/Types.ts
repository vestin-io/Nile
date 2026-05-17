import type { ConnectionApplyRequirementKind } from "../../connection/RequirementKinds";
import type { ConnectionFamilyId } from "../../connection/family/Types";
import type { AgentId } from "../Ids";

export type AgentConnectionEntryMode = "configure" | "import" | "configure_or_import";

export type AgentHomeCandidateDefinition = {
  path: string;
  markers: readonly string[];
};

export type AgentManifestDefinition = {
  id: AgentId;
  label: string;
  iconKey: string;
  homeCandidates: readonly AgentHomeCandidateDefinition[];
  requiredApplyRequirements: ConnectionApplyRequirementKind[];
  supportsManagedEnvBackedApiKey: boolean;
  supportedConnectionFamilyIds: ConnectionFamilyId[];
  autoSyncMatchedSelection: boolean;
  connectionEntryMode: AgentConnectionEntryMode;
};

export type AgentDeclarationDefinition = Omit<AgentManifestDefinition, "homeCandidates">;
