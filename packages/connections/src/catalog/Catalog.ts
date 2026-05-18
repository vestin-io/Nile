import { CONNECTION_FAMILY_REGISTRY } from "@nile/core/models/connection/family";
import type { AccessRegistry, AccessRecord } from "@nile/core/models/access";
import type { EndpointRegistry, EndpointRecord } from "@nile/core/models/endpoint";
import type { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import {
  isDirectApiKeyCredential,
  isEnvKeyApiKeyCredential,
  type StoredCredential,
} from "@nile/core/services/credential/Types";
import type { LocalModelCatalogSource } from "@nile/core/application/local/model-catalog-source";

import type { ConnectionModelCatalogResult } from "./Types";
import { OpenAiReader } from "./OpenAiReader";
import { CodexReader } from "./CodexReader";

type AccessLookup = Pick<AccessRegistry, "get" | "readCredential">;
type EndpointLookup = Pick<EndpointRegistry, "get">;

export class ConnectionModelCatalog {
  private readonly openAiCatalogReader: OpenAiReader;
  private readonly codexCatalogReader: CodexReader;

  constructor(
    private readonly endpointRegistry: EndpointLookup,
    private readonly accessRegistry: AccessLookup,
    private readonly environment: EnvironmentSource,
    private readonly localModelCatalogSources: readonly LocalModelCatalogSource[] = [],
    private readonly fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.openAiCatalogReader = new OpenAiReader(this.fetchFn);
    this.codexCatalogReader = new CodexReader(this.fetchFn);
  }

  async read(connectionId: string): Promise<ConnectionModelCatalogResult> {
    const access = this.accessRegistry.get(connectionId);
    if (!access) {
      throw new Error(`Connection not found: ${connectionId}`);
    }
    const credential = this.accessRegistry.readCredential(connectionId);

    const endpoint = this.endpointRegistry.get(access.endpointId);
    if (!endpoint) {
      return {
        connectionId,
        status: "error",
        models: [],
        message: "Connection metadata is incomplete",
      };
    }

    const cachedGatewayModels = this.readLocalModelCatalogModels(endpoint);
    const sessionCatalog = await this.readSessionModelCatalog(access, endpoint, credential);
    if (sessionCatalog) {
      return this.mergeSessionCatalogResult(connectionId, cachedGatewayModels, sessionCatalog);
    }

    const authorization = this.readOpenAiAuthorization(access, credential);
    const shouldProbeGenericGatewayOpenAi =
      endpoint.profile === "generic-gateway" && access.authMode === "api_key" && Boolean(authorization);

    if (!endpoint.protocols.openai && !shouldProbeGenericGatewayOpenAi) {
      if (cachedGatewayModels.length > 0) {
        return {
          connectionId,
          status: "available",
          models: cachedGatewayModels,
        };
      }
      return {
        connectionId,
        status: "unavailable",
        models: [],
        message: "Model detection is not available for this connection yet",
      };
    }
    if (!authorization) {
      if (cachedGatewayModels.length > 0) {
        return {
          connectionId,
          status: "available",
          models: cachedGatewayModels,
        };
      }
      return {
        connectionId,
        status: "unavailable",
        models: [],
        message: "This connection does not expose a readable OpenAI-compatible credential",
      };
    }

    try {
      if (this.shouldUseCodexModelCatalog(access, endpoint, credential)) {
        return await this.codexCatalogReader.read(connectionId, authorization);
      }
      const openAiCatalog = await this.openAiCatalogReader.read(connectionId, endpoint, authorization);
      return this.mergeResults(connectionId, cachedGatewayModels, openAiCatalog);
    } catch (error) {
      if (cachedGatewayModels.length > 0) {
        return {
          connectionId,
          status: "available",
          models: cachedGatewayModels,
        };
      }
      return {
        connectionId,
        status: "error",
        models: [],
        message: this.readFetchErrorMessage(access, endpoint, error),
      };
    }
  }

  private shouldUseCodexModelCatalog(
    access: AccessRecord,
    endpoint: EndpointRecord,
    credential: StoredCredential,
  ): boolean {
    return this.readOpenAiSessionModelCatalogReader(access, endpoint)
      ?.shouldUseCodexModelCatalog(endpoint, credential) === true;
  }

  private mergeResults(
    connectionId: string,
    cachedGatewayModels: string[],
    openAiCatalog: ConnectionModelCatalogResult,
  ): ConnectionModelCatalogResult {
    const models = this.mergeModelIds(openAiCatalog.models, cachedGatewayModels);
    if (models.length > 0) {
      return {
        connectionId,
        status: "available",
        models,
      };
    }
    if (cachedGatewayModels.length > 0) {
      return {
        connectionId,
        status: "available",
        models: cachedGatewayModels,
      };
    }
    return openAiCatalog;
  }

  private mergeSessionCatalogResult(
    connectionId: string,
    cachedGatewayModels: string[],
    sessionCatalog: { status: "available" | "unavailable" | "error"; models: string[]; message?: string },
  ): ConnectionModelCatalogResult {
    const models = this.mergeModelIds(sessionCatalog.models, cachedGatewayModels);
    if (models.length > 0) {
      return {
        connectionId,
        status: "available",
        models,
      };
    }
    if (cachedGatewayModels.length > 0) {
      return {
        connectionId,
        status: "available",
        models: cachedGatewayModels,
      };
    }
    return {
      connectionId,
      status: sessionCatalog.status,
      models: [],
      ...(sessionCatalog.message ? { message: sessionCatalog.message } : {}),
    };
  }

  private readOpenAiAuthorization(
    access: AccessRecord,
    credential: StoredCredential,
  ): { token: string; accountId?: string } | null {
    const endpoint = this.endpointRegistry.get(access.endpointId);
    const sessionAuthorization = endpoint
      ? this.readOpenAiSessionModelCatalogReader(access, endpoint)?.readAuthorization(credential)
      : null;
    if (sessionAuthorization) {
      return sessionAuthorization;
    }

    if (access.authMode !== "api_key" || credential.kind !== "api_key") {
      return null;
    }

    if (isDirectApiKeyCredential(credential)) {
      return credential.apiKey.trim() ? { token: credential.apiKey.trim() } : null;
    }

    if (isEnvKeyApiKeyCredential(credential)) {
      const apiKey = this.environment.read(credential.envKey);
      return apiKey ? { token: apiKey } : null;
    }

    return null;
  }

  private readLocalModelCatalogModels(endpoint: EndpointRecord): string[] {
    const seen = new Set<string>();
    const models: string[] = [];
    for (const source of this.localModelCatalogSources) {
      for (const modelId of source.readModels(endpoint)) {
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

  private mergeModelIds(...groups: string[][]): string[] {
    const seen = new Set<string>();
    const models: string[] = [];
    for (const group of groups) {
      for (const modelId of group) {
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

  private readFetchErrorMessage(
    access: AccessRecord,
    endpoint: EndpointRecord,
    error: unknown,
  ): string {
    if (this.shouldUseCodexModelCatalog(access, endpoint, this.accessRegistry.readCredential(access.id))) {
      return this.codexCatalogReader.readFetchErrorMessage(error);
    }
    return this.openAiCatalogReader.readFetchErrorMessage(error);
  }

  private readOpenAiSessionModelCatalogReader(access: AccessRecord, endpoint: EndpointRecord) {
    for (const family of CONNECTION_FAMILY_REGISTRY.readSavedFamilyIds({
      protocols: {
        openai: endpoint.protocols.openai,
        anthropic: endpoint.protocols.anthropic,
        cursor: endpoint.protocols.cursor,
        gemini: endpoint.protocols.gemini,
      },
      authMode: access.authMode,
    })) {
      const module = CONNECTION_FAMILY_REGISTRY.readModule(family);
      if (module.behaviors.openAiSessionModelCatalogReader) {
        return module.behaviors.openAiSessionModelCatalogReader;
      }
    }
    return null;
  }

  private async readSessionModelCatalog(
    access: AccessRecord,
    endpoint: EndpointRecord,
    credential: StoredCredential,
  ): Promise<{ status: "available" | "unavailable" | "error"; models: string[]; message?: string } | null> {
    for (const family of CONNECTION_FAMILY_REGISTRY.readSavedFamilyIds({
      protocols: {
        openai: endpoint.protocols.openai,
        anthropic: endpoint.protocols.anthropic,
        cursor: endpoint.protocols.cursor,
        gemini: endpoint.protocols.gemini,
      },
      authMode: access.authMode,
    })) {
      const module = CONNECTION_FAMILY_REGISTRY.readModule(family);
      if (module.behaviors.sessionModelCatalogReader) {
        return await module.behaviors.sessionModelCatalogReader.read(endpoint, credential, this.fetchFn);
      }
    }
    return null;
  }
}
