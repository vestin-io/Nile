import type { AgentHomes } from "../../models/agent/Homes";
import type { EndpointRecord } from "../../models/endpoint";

export type LocalModelCatalogSource = {
  readModels(endpoint: EndpointRecord): string[];
};

export type LocalModelCatalogSourceManifest = {
  id: string;
  create(agentHomes: AgentHomes | undefined): LocalModelCatalogSource;
};
