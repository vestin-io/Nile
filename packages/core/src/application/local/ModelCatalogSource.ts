import type { AgentHomes } from "../../models/agent/Homes";
import { AGENT_MODULE_REGISTRY } from "../../models/agent/module/Registry";
import type { LocalModelCatalogSource, LocalModelCatalogSourceManifest } from "./ModelCatalogSourceTypes";
export type { LocalModelCatalogSource, LocalModelCatalogSourceManifest } from "./ModelCatalogSourceTypes";

export function listLocalModelCatalogSourceManifests(): LocalModelCatalogSourceManifest[] {
  return AGENT_MODULE_REGISTRY.list().flatMap((module) =>
    module.localModelCatalogSources ? [...module.localModelCatalogSources] : []);
}

export class LocalModelCatalogSourceRegistry {
  list(): LocalModelCatalogSourceManifest[] {
    return listLocalModelCatalogSourceManifests();
  }

  createAll(agentHomes: AgentHomes | undefined): LocalModelCatalogSource[] {
    return listLocalModelCatalogSourceManifests().map((manifest) => manifest.create(agentHomes));
  }
}

export const LOCAL_MODEL_CATALOG_SOURCE_REGISTRY = new LocalModelCatalogSourceRegistry();
