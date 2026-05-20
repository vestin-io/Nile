import type { AgentManifestDefinition } from "../registry/Types";
import type { LocalModelCatalogSourceManifest } from "../../../application/local/ModelCatalogSourceTypes";
import type { AgentProjectionRegistration } from "../../../projection/Types";
import type { AgentFactoryRegistration } from "../../../runtime-local/Types";
import type { CurrentSessionSourceManifest } from "../../../session/Types";
import type { InteractiveSessionLoginManifest } from "../../../session/LoginTypes";
import type { LocalConnectionSupportFactory } from "../../../runtime-local/LocalConnectionSupport";
import type { AgentLocalRuntimeInfoProvider } from "./LocalRuntimeInfo";

export type AgentModule = {
  manifest: AgentManifestDefinition;
  runtimeFactory: AgentFactoryRegistration;
  projection: AgentProjectionRegistration;
  currentSessionSource?: CurrentSessionSourceManifest;
  interactiveSessionLogin?: InteractiveSessionLoginManifest;
  localModelCatalogSources?: readonly LocalModelCatalogSourceManifest[];
  localConnectionSupportFactory?: LocalConnectionSupportFactory;
  localRuntimeInfo?: AgentLocalRuntimeInfoProvider;
};
