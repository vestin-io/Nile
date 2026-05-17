import { joinEndpointUrl } from "@nile/core/projection/Url";
import type { EndpointRecord } from "@nile/core/models/endpoint";

import type { ConnectionModelCatalogResult } from "./Types";

const MODEL_REQUEST_TIMEOUT_MS = 10_000;

type OpenAiModelListResponse = {
  data?: Array<{
    id?: unknown;
  }>;
};

export class OpenAiReader {
  constructor(private readonly fetchFn: typeof fetch = globalThis.fetch.bind(globalThis)) {}

  async read(
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

  readFetchErrorMessage(error: unknown): string {
    if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") {
      return `Model detection timed out after ${MODEL_REQUEST_TIMEOUT_MS}ms`;
    }
    return error instanceof Error
      ? `Model detection failed: ${error.message}`
      : "Model detection failed";
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
}
