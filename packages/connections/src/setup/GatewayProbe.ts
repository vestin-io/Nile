import { createHash } from "node:crypto";

import type {
  EndpointAnthropicProtocol,
  EndpointOpenAiProtocol,
} from "@nile/core/models/endpoint";
import type { GatewayCapabilityProbe, GatewayProbeResult } from "@nile/core/models/connection";

const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_CACHE_TTL_MS = 2 * 60 * 1000;

type OpenAiModelListResponse = {
  data?: Array<{
    id?: unknown;
  }>;
};

export class GatewayProbe implements GatewayCapabilityProbe {
  private static readonly cache = new Map<string, { expiresAt: number; result: GatewayProbeResult }>();
  private readonly cacheEnabled: boolean;

  constructor(
    private readonly fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.cacheEnabled = arguments.length === 0;
  }

  async probe(baseUrl: string, apiKey: string): Promise<GatewayProbeResult> {
    const cacheKey = this.cacheEnabled ? this.readCacheKey(baseUrl, apiKey) : null;
    const cached = cacheKey ? this.readCachedResult(cacheKey) : null;
    if (cached) {
      return cached;
    }

    const parsed = new URL(baseUrl);
    const inputPath = this.normalizePath(parsed.pathname);
    const rootUrl = parsed.origin;

    const [openai, anthropic] = await Promise.all([
      this.probeOpenAi(rootUrl, inputPath, apiKey),
      this.probeAnthropic(rootUrl, inputPath, apiKey),
    ]);

    if (!openai && !anthropic) {
      throw new Error(`Unable to detect supported gateway protocols at ${baseUrl}`);
    }

    const result = { openai, anthropic };
    if (cacheKey) {
      GatewayProbe.cache.set(cacheKey, {
        expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS,
        result,
      });
    }
    return result;
  }

  private async probeOpenAi(
    rootUrl: string,
    inputPath: string,
    apiKey: string,
  ): Promise<EndpointOpenAiProtocol | null> {
    const basePath = inputPath || "/v1";
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    };
    const modelsUrl = this.buildUrl(rootUrl, `${basePath}/models`);
    const probeModels = await this.readOpenAiProbeModels(modelsUrl, headers);

    const [supportsResponses, supportsChat] = await Promise.all([
      this.findWorkingOpenAiWireApi(
        this.buildUrl(rootUrl, `${basePath}/responses`),
        headers,
        probeModels,
        (modelId) => ({
          model: modelId,
          input: "ping",
        }),
      ),
      this.findWorkingOpenAiWireApi(
        this.buildUrl(rootUrl, `${basePath}/chat/completions`),
        headers,
        probeModels,
        (modelId) => ({
          model: modelId,
          messages: [{ role: "user", content: "ping" }],
          stream: false,
        }),
      ),
    ]);

    if (!supportsResponses && !supportsChat) {
      return null;
    }

    const wireApis: EndpointOpenAiProtocol["wireApis"] = [];
    if (supportsResponses) {
      wireApis.push("responses");
    }
    if (supportsChat) {
      wireApis.push("chat");
    }
    if (wireApis.length === 0) {
      return null;
    }

    return {
      basePath,
      wireApis,
      authSchemes: ["bearer"],
      envKeyOverride: "OPENAI_API_KEY",
    };
  }

  private async readOpenAiProbeModels(
    url: string,
    headers: Record<string, string>,
  ): Promise<string[]> {
    try {
      const response = await this.fetchFn(url, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      if (!response.ok) {
        return [];
      }

      const payload = await response.json() as OpenAiModelListResponse;
      const modelIds = (payload.data ?? [])
        .map((model) => (typeof model.id === "string" ? model.id.trim() : ""))
        .filter((modelId) => Boolean(modelId));
      return this.orderOpenAiProbeModels(modelIds);
    } catch {
      return [];
    }
  }

  private orderOpenAiProbeModels(modelIds: string[]): string[] {
    if (modelIds.length === 0) {
      return [];
    }

    const preferredModelIds = [
      "gpt-5.4",
      "gpt-5.3-codex",
      "gpt-5.2-codex",
      "gpt-5-codex",
      "gpt-5",
      "gpt-4.1",
      "gpt-4o",
      "gpt-4o-mini",
    ];
    const ordered: string[] = [];
    for (const preferredModelId of preferredModelIds) {
      if (modelIds.includes(preferredModelId)) {
        ordered.push(preferredModelId);
      }
    }

    for (const modelId of modelIds) {
      if (modelId.startsWith("gpt-") && !ordered.includes(modelId)) {
        ordered.push(modelId);
      }
    }
    for (const modelId of modelIds) {
      if (!ordered.includes(modelId)) {
        ordered.push(modelId);
      }
    }

    return ordered;
  }

  private async findWorkingOpenAiWireApi(
    url: string,
    headers: Record<string, string>,
    modelIds: string[],
    buildBody: (modelId: string) => Record<string, unknown>,
  ): Promise<boolean> {
    for (const modelId of modelIds) {
      const succeeded = await this.requestSucceeds(url, {
        method: "POST",
        headers,
        body: JSON.stringify(buildBody(modelId)),
      });
      if (succeeded) {
        return true;
      }
    }
    return false;
  }

  private async requestSucceeds(
    url: string,
    init: RequestInit,
  ): Promise<boolean> {
    try {
      const response = await this.fetchFn(url, {
        ...init,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async probeAnthropic(
    rootUrl: string,
    inputPath: string,
    apiKey: string,
  ): Promise<EndpointAnthropicProtocol | null> {
    const rawPath = inputPath ? `${inputPath}/messages` : "/v1/messages";
    const basePath = inputPath || undefined;

    const bearerSupported = await this.routeExists(
      this.buildUrl(rootUrl, rawPath),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "anthropic-version": DEFAULT_ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: "{}",
      },
    );
    if (bearerSupported) {
      return {
        ...(basePath ? { basePath } : {}),
        authSchemes: ["bearer"],
        envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
        versionHeader: DEFAULT_ANTHROPIC_VERSION,
      };
    }

    const xApiKeySupported = await this.routeExists(
      this.buildUrl(rootUrl, rawPath),
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": DEFAULT_ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: "{}",
      },
    );
    if (!xApiKeySupported) {
      return null;
    }

    return {
      ...(basePath ? { basePath } : {}),
      authSchemes: ["x_api_key"],
      envKeyOverride: "ANTHROPIC_API_KEY",
      versionHeader: DEFAULT_ANTHROPIC_VERSION,
    };
  }

  private async routeExists(url: string, init: RequestInit): Promise<boolean> {
    try {
      const response = await this.fetchFn(url, {
        ...init,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      return response.status !== 404;
    } catch {
      return false;
    }
  }

  private buildUrl(rootUrl: string, path: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${rootUrl}${normalizedPath}`;
  }

  private normalizePath(pathname: string): string {
    const normalized = pathname.replace(/\/+$/, "");
    if (!normalized || normalized === "/") {
      return "";
    }
    return normalized;
  }

  private readCacheKey(baseUrl: string, apiKey: string): string {
    const hash = createHash("sha256");
    hash.update(baseUrl);
    hash.update("\u0000");
    hash.update(apiKey);
    return hash.digest("hex");
  }

  private readCachedResult(cacheKey: string): GatewayProbeResult | null {
    const cached = GatewayProbe.cache.get(cacheKey);
    if (!cached) {
      return null;
    }
    if (cached.expiresAt <= Date.now()) {
      GatewayProbe.cache.delete(cacheKey);
      return null;
    }
    return cached.result;
  }
}
