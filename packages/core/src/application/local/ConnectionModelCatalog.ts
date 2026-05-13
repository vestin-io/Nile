import { ClaudeGatewayModelCatalog } from "../../agents/claude/GatewayModelCatalog";
import { joinEndpointUrl } from "../../projection/Url";
import type { AccessRegistry, AccessRecord } from "../../models/access";
import type { EndpointRegistry, EndpointRecord } from "../../models/endpoint";
import type { EnvironmentSource } from "../../services/EnvironmentSource";
import {
  isDirectApiKeyCredential,
  isEnvKeyApiKeyCredential,
  type OpenAiSessionCredential,
  type StoredCredential,
} from "../../services/credential/Types";

const MODEL_REQUEST_TIMEOUT_MS = 10_000;
const CODEX_MODELS_CLIENT_VERSION = "1.0.0";
const CODEX_MODELS_URL = `https://chatgpt.com/backend-api/codex/models?client_version=${CODEX_MODELS_CLIENT_VERSION}`;

type OpenAiModelListResponse = {
  data?: Array<{
    id?: unknown;
  }>;
};

type CodexModelListResponse = {
  models?: Array<{
    slug?: unknown;
  }>;
};

export type ConnectionModelCatalogResult = {
  connectionId: string;
  status: "available" | "unavailable" | "error";
  models: string[];
  message?: string;
};

type AccessLookup = Pick<AccessRegistry, "get" | "readCredential">;
type EndpointLookup = Pick<EndpointRegistry, "get">;
type ClaudeGatewayModels = Pick<ClaudeGatewayModelCatalog, "readModels">;

export class ConnectionModelCatalog {
  constructor(
    private readonly endpointRegistry: EndpointLookup,
    private readonly accessRegistry: AccessLookup,
    private readonly environment: EnvironmentSource,
    private readonly claudeGatewayModels: ClaudeGatewayModels | null = null,
    private readonly fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  async read(connectionId: string): Promise<ConnectionModelCatalogResult> {
    const access = this.accessRegistry.get(connectionId);
    if (!access) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const endpoint = this.endpointRegistry.get(access.endpointId);
    if (!endpoint) {
      return {
        connectionId,
        status: "error",
        models: [],
        message: "Connection metadata is incomplete",
      };
    }

    const cachedGatewayModels = this.readClaudeGatewayModels(connectionId, endpoint);
    const authorization = this.readOpenAiAuthorization(access, this.accessRegistry.readCredential(connectionId));
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
      if (this.shouldUseCodexModelCatalog(access, endpoint)) {
        return await this.readCodexModelCatalog(connectionId, authorization);
      }
      const openAiCatalog = await this.readOpenAiModelCatalog(connectionId, endpoint, authorization);
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
        message: this.readFetchErrorMessage(error),
      };
    }
  }

  private shouldUseCodexModelCatalog(access: AccessRecord, endpoint: EndpointRecord): boolean {
    return (
      (access.authMode === "openai_session" || access.authMode === "openclaw_openai_session")
      && endpoint.profile === "openai-official"
    );
  }

  private async readCodexModelCatalog(
    connectionId: string,
    authorization: { token: string; accountId?: string },
  ): Promise<ConnectionModelCatalogResult> {
    const response = await this.fetchWithTimeout(CODEX_MODELS_URL, {
      method: "GET",
      headers: {
        authorization: `Bearer ${authorization.token}`,
        accept: "application/json",
        "user-agent": `codex-cli/${CODEX_MODELS_CLIENT_VERSION}`,
        ...(authorization.accountId ? { "chatgpt-account-id": authorization.accountId } : {}),
      },
    });
    if (!response.ok) {
      return {
        connectionId,
        status: "error",
        models: [],
        message: `Model detection failed with status ${response.status}`,
      };
    }

    const payload = await response.json() as CodexModelListResponse;
    const models = this.readCodexModelIds(payload);
    if (models.length === 0) {
      return {
        connectionId,
        status: "unavailable",
        models: [],
        message: "No models were returned for this connection",
      };
    }

    return {
      connectionId,
      status: "available",
      models,
    };
  }

  private async readOpenAiModelCatalog(
    connectionId: string,
    endpoint: EndpointRecord,
    authorization: { token: string; accountId?: string },
  ): Promise<ConnectionModelCatalogResult> {
    const basePath = endpoint.protocols.openai?.basePath ?? "/v1";
    const url = joinEndpointUrl(endpoint.rootUrl, `${basePath}/models`);
    const response = await this.fetchWithTimeout(url, {
      method: "GET",
      headers: {
        authorization: `Bearer ${authorization.token}`,
        "content-type": "application/json",
        ...(authorization.accountId ? { "chatgpt-account-id": authorization.accountId } : {}),
      },
    });
    if (!response.ok) {
      return {
        connectionId,
        status: "error",
        models: [],
        message: `Model detection failed with status ${response.status}`,
      };
    }

    const payload = await response.json() as OpenAiModelListResponse;
    const models = this.readModelIds(payload);
    if (models.length === 0) {
      return {
        connectionId,
        status: "unavailable",
        models: [],
        message: "No models were returned for this connection",
      };
    }

    return {
      connectionId,
      status: "available",
      models,
    };
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

  private readOpenAiAuthorization(
    access: AccessRecord,
    credential: StoredCredential,
  ): { token: string; accountId?: string } | null {
    if (access.authMode === "openai_session" && credential.kind === "openai_session") {
      return this.readOpenAiSessionAuthorization(credential);
    }

    if (access.authMode === "openclaw_openai_session" && credential.kind === "openclaw_openai_session") {
      return this.readOpenAiSessionAuthorization(credential);
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

  private readOpenAiSessionAuthorization(
    credential: OpenAiSessionCredential | Extract<StoredCredential, { kind: "openclaw_openai_session" }>,
  ): { token: string; accountId?: string } | null {
    const accessToken = credential.accessToken.trim();
    if (!accessToken) {
      return null;
    }
    return {
      token: accessToken,
      ...(credential.accountId?.trim() ? { accountId: credential.accountId.trim() } : {}),
    };
  }

  private readClaudeGatewayModels(connectionId: string, endpoint: EndpointRecord): string[] {
    if (!this.claudeGatewayModels) {
      return [];
    }

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
      for (const modelId of this.claudeGatewayModels.readModels(baseUrl)) {
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

  private readModelIds(payload: OpenAiModelListResponse): string[] {
    const seen = new Set<string>();
    const models: string[] = [];
    for (const entry of payload.data ?? []) {
      if (typeof entry.id !== "string") {
        continue;
      }
      const modelId = entry.id.trim();
      if (!modelId || seen.has(modelId)) {
        continue;
      }
      seen.add(modelId);
      models.push(modelId);
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

  private readCodexModelIds(payload: CodexModelListResponse): string[] {
    const seen = new Set<string>();
    const models: string[] = [];
    for (const entry of payload.models ?? []) {
      if (typeof entry.slug !== "string") {
        continue;
      }
      const modelId = entry.slug.trim();
      if (!modelId || seen.has(modelId)) {
        continue;
      }
      seen.add(modelId);
      models.push(modelId);
    }
    return models;
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MODEL_REQUEST_TIMEOUT_MS);
    try {
      return await this.fetchFn(url, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private readFetchErrorMessage(error: unknown): string {
    if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") {
      return `Model detection timed out after ${MODEL_REQUEST_TIMEOUT_MS}ms`;
    }
    return error instanceof Error
      ? `Model detection failed: ${error.message}`
      : "Model detection failed";
  }
}
