import type { ConnectionModelCatalogResult } from "./Types";

const MODEL_REQUEST_TIMEOUT_MS = 10_000;
const CODEX_MODELS_CLIENT_VERSION = "1.0.0";
const CODEX_MODELS_URL = `https://chatgpt.com/backend-api/codex/models?client_version=${CODEX_MODELS_CLIENT_VERSION}`;

type CodexModelListResponse = {
  models?: Array<{
    slug?: unknown;
  }>;
};

export class CodexReader {
  constructor(private readonly fetchFn: typeof fetch = globalThis.fetch.bind(globalThis)) {}

  async read(
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

  private readModelIds(payload: CodexModelListResponse): string[] {
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
}
