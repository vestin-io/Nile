import { join } from "node:path";

import type {
  LocalModelCatalogSource,
  LocalModelCatalogSourceManifest,
} from "@nile/core/application/local/ModelCatalogSourceTypes";
import { resolveAgentHome } from "@nile/core/models/agent/homes";
import { joinEndpointUrl } from "@nile/core/projection/Url";
import type { EndpointRecord } from "@nile/core/models/endpoint";
import { ClaudeGatewayModelCatalog } from "./GatewayModelCatalog";

class GatewayCacheSource implements LocalModelCatalogSource {
  constructor(private readonly gatewayModels: ClaudeGatewayModelCatalog) {}

  readModels(endpoint: EndpointRecord): string[] {
    const candidateBaseUrls = [
      endpoint.protocols.anthropic
        ? joinEndpointUrl(endpoint.rootUrl, endpoint.protocols.anthropic.basePath)
        : null,
      endpoint.protocols.openai
        ? joinEndpointUrl(endpoint.rootUrl, endpoint.protocols.openai.basePath)
        : null,
    ].filter((value): value is string => Boolean(value));

    const seen = new Set<string>();
    const models: string[] = [];
    for (const baseUrl of candidateBaseUrls) {
      for (const modelId of this.gatewayModels.readModels(baseUrl)) {
        const normalizedModelId = modelId.trim();
        if (!normalizedModelId || seen.has(normalizedModelId)) {
          continue;
        }
        seen.add(normalizedModelId);
        models.push(normalizedModelId);
      }
    }
    return models;
  }
}

export const CLAUDE_MODEL_CATALOG_SOURCE = {
  id: "claude-gateway-cache",
  create(agentHomes) {
    const claudeHome = resolveAgentHome("claude", agentHomes);
    return new GatewayCacheSource(
      new ClaudeGatewayModelCatalog(join(claudeHome, "settings.json")),
    );
  },
} as const satisfies LocalModelCatalogSourceManifest;
