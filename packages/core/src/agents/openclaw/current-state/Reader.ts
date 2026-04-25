import { ConnectionNaming } from "../../../models/connection/Naming";
import type { EndpointProfile, EndpointRegistryInput } from "../../../models/endpoint";
import { splitEndpointUrl } from "../../../projection/Url";
import type { ApiKeyCredential } from "../../../services/credential/Types";
import { OpenClawConfigStore } from "../OpenClawConfigStore";
import type { OpenClawDetectedAccess, OpenClawDetectedEndpoint } from "../types";
import type { ReadCurrentStateResult, ResolvedLiveState } from "./Internal";

const OPENAI_HOST_MARKERS = ["api.openai.com"];
const AZURE_HOST_MARKERS = [".cognitiveservices.azure.com", ".openai.azure.com"];
const ANTHROPIC_HOST_MARKERS = ["api.anthropic.com"];

type JsonObject = Record<string, unknown>;

export class CurrentStateReader {
  constructor(private readonly configStore: OpenClawConfigStore) {}

  read(): ReadCurrentStateResult {
    const snapshot = this.configStore.snapshot();
    if (snapshot === null) {
      return {
        kind: "invalid_structure",
        issues: [`OpenClaw config not found at ${this.configStore.configPath}`],
      };
    }

    if (!snapshot.trim()) {
      return {
        kind: "invalid_structure",
        issues: [`OpenClaw config is empty at ${this.configStore.configPath}`],
      };
    }

    let config: Record<string, unknown>;
    try {
      config = this.configStore.readParsedConfig();
    } catch (error) {
      return {
        kind: "invalid_structure",
        issues: [error instanceof Error ? error.message : String(error)],
      };
    }

    const primary = this.readPrimary(config);
    if ("error" in primary) {
      return {
        kind: "invalid_semantics",
        issues: [primary.error],
        endpoint: null,
        access: null,
      };
    }

    const provider = this.readProvider(config, primary.providerId);
    if ("error" in provider) {
      return {
        kind: "invalid_semantics",
        issues: [provider.error],
        endpoint: null,
        access: null,
      };
    }

    const resolved = this.resolveLiveState(primary.providerId, primary.modelId, provider.value);
    if ("error" in resolved) {
      return {
        kind: "invalid_semantics",
        issues: [resolved.error],
        endpoint: resolved.endpoint ?? null,
        access: resolved.access ?? null,
      };
    }

    return {
      kind: "resolved",
      value: resolved.value,
    };
  }

  private readPrimary(
    config: Record<string, unknown>,
  ): { providerId: string; modelId: string } | { error: string } {
    const primary = asObject(config.agents)?.defaults;
    const primaryValue = asObject(primary)?.model;
    const primaryString = asObject(primaryValue)?.primary;
    if (typeof primaryString !== "string" || !primaryString.trim()) {
      return { error: "OpenClaw config does not define agents.defaults.model.primary" };
    }

    const slashIndex = primaryString.indexOf("/");
    if (slashIndex <= 0 || slashIndex === primaryString.length - 1) {
      return {
        error: `OpenClaw primary model must use provider/model format, received: ${primaryString}`,
      };
    }

    return {
      providerId: primaryString.slice(0, slashIndex).trim(),
      modelId: primaryString.slice(slashIndex + 1).trim(),
    };
  }

  private readProvider(
    config: Record<string, unknown>,
    providerId: string,
  ): { value: JsonObject } | { error: string } {
    const providers = asObject(asObject(config.models)?.providers);
    if (!providers) {
      return { error: "OpenClaw config does not define models.providers" };
    }

    const provider = asObject(providers[providerId]);
    if (!provider) {
      return {
        error: `OpenClaw config does not contain provider ${providerId} referenced by agents.defaults.model.primary`,
      };
    }

    return { value: provider };
  }

  private resolveLiveState(
    providerId: string,
    modelId: string,
    provider: JsonObject,
  ): { value: ResolvedLiveState } | { error: string; endpoint?: OpenClawDetectedEndpoint; access?: OpenClawDetectedAccess } {
    const baseUrl = readString(provider.baseUrl);
    if (!baseUrl) {
      return { error: `OpenClaw provider ${providerId} is missing baseUrl` };
    }

    const apiKey = readString(provider.apiKey);
    if (!apiKey) {
      return { error: `OpenClaw provider ${providerId} is missing apiKey` };
    }

    const api = readString(provider.api);
    if (!api) {
      return { error: `OpenClaw provider ${providerId} is missing api` };
    }

    if (api === "openai-completions" || api === "openai-responses") {
      return {
        value: this.buildOpenAiState(providerId, modelId, baseUrl, apiKey, api),
      };
    }

    if (api === "anthropic-messages") {
      return {
        value: this.buildAnthropicState(providerId, modelId, baseUrl, apiKey),
      };
    }

    return {
      error: `OpenClaw provider ${providerId} uses unsupported api protocol ${api}`,
    };
  }

  private buildOpenAiState(
    providerId: string,
    modelId: string,
    baseUrl: string,
    apiKey: string,
    api: "openai-completions" | "openai-responses",
  ): ResolvedLiveState {
    const endpointFamily = this.inferOpenAiEndpointFamily(providerId, baseUrl);
    const endpoint = this.buildOpenAiEndpoint(providerId, endpointFamily, baseUrl, api);
    const detectedEndpoint: OpenClawDetectedEndpoint = {
      endpointFamily,
      endpointIdHint: providerId,
      labelHint: endpoint.label,
      baseUrl,
      wireApi: api === "openai-completions" ? "chat" : "responses",
    };
    const detectedAccess: OpenClawDetectedAccess = {
      authMode: "api_key",
      labelHint: `${endpoint.label} ${modelId}`,
      openclawModelId: modelId,
    };

    return {
      endpoint,
      access: {
        authMode: "api_key",
        label: detectedAccess.labelHint,
        openclawModelId: modelId,
      },
      detectedEndpoint,
      credential: {
        kind: "api_key",
        source: "direct",
        apiKey,
      },
      detectedAccess,
    };
  }

  private buildAnthropicState(
    providerId: string,
    modelId: string,
    baseUrl: string,
    apiKey: string,
  ): ResolvedLiveState {
    const endpoint = this.buildAnthropicEndpoint(providerId, baseUrl);
    const detectedEndpoint: OpenClawDetectedEndpoint = {
      endpointFamily: "anthropic",
      endpointIdHint: providerId,
      labelHint: endpoint.label,
      baseUrl,
    };
    const detectedAccess: OpenClawDetectedAccess = {
      authMode: "api_key",
      labelHint: `${endpoint.label} ${modelId}`,
      openclawModelId: modelId,
    };

    return {
      endpoint,
      access: {
        authMode: "api_key",
        label: detectedAccess.labelHint,
        openclawModelId: modelId,
      },
      detectedEndpoint,
      credential: {
        kind: "api_key",
        source: "direct",
        apiKey,
      },
      detectedAccess,
    };
  }

  private buildOpenAiEndpoint(
    providerId: string,
    endpointFamily: OpenClawDetectedEndpoint["endpointFamily"],
    baseUrl: string,
    api: "openai-completions" | "openai-responses",
  ): EndpointRegistryInput {
    const { rootUrl, path } = splitEndpointUrl(baseUrl);
    const profile: EndpointProfile =
      endpointFamily === "azure-openai"
        ? "azure-openai"
        : endpointFamily === "gateway"
          ? "generic-gateway"
          : "openai-official";

    return {
      id: providerId,
      label: this.suggestOpenAiEndpointLabel(endpointFamily, rootUrl, baseUrl),
      rootUrl,
      profile,
      protocols: {
        openai: {
          ...(path ? { basePath: path } : {}),
          wireApis: [api === "openai-completions" ? "chat" : "responses"],
          authSchemes: ["bearer"],
        },
      },
    };
  }

  private buildAnthropicEndpoint(
    providerId: string,
    baseUrl: string,
  ): EndpointRegistryInput {
    const { rootUrl, path } = splitEndpointUrl(baseUrl);
    const authSchemes = ANTHROPIC_HOST_MARKERS.some((marker) => rootUrl.includes(marker))
      ? ["x_api_key"] as const
      : ["bearer"] as const;

    return {
      id: providerId,
      label: this.suggestAnthropicEndpointLabel(rootUrl),
      rootUrl,
      profile: "anthropic-official",
      protocols: {
        anthropic: {
          ...(path ? { basePath: path } : {}),
          authSchemes: [...authSchemes],
        },
      },
    };
  }

  private inferOpenAiEndpointFamily(
    providerId: string,
    baseUrl: string,
  ): OpenClawDetectedEndpoint["endpointFamily"] {
    if (providerId === "openai") {
      return "openai";
    }
    if (OPENAI_HOST_MARKERS.some((marker) => baseUrl.includes(marker))) {
      return "openai";
    }
    if (AZURE_HOST_MARKERS.some((marker) => baseUrl.includes(marker))) {
      return "azure-openai";
    }
    return "gateway";
  }

  private suggestOpenAiEndpointLabel(
    endpointFamily: OpenClawDetectedEndpoint["endpointFamily"],
    rootUrl: string,
    baseUrl: string,
  ): string {
    if (endpointFamily === "azure-openai") {
      const resource = ConnectionNaming.prettifyAzureResource(baseUrl);
      return resource ? `Azure OpenAI (${resource})` : "Azure OpenAI";
    }
    if (endpointFamily === "gateway") {
      const host = ConnectionNaming.prettifyHost(rootUrl);
      return host === "openrouter.ai" ? "OpenRouter" : host ? `Gateway (${host})` : "Gateway";
    }
    return "OpenAI";
  }

  private suggestAnthropicEndpointLabel(rootUrl: string): string {
    const host = ConnectionNaming.prettifyHost(rootUrl);
    return host && host !== "api.anthropic.com" ? `Anthropic (${host})` : "Anthropic";
  }
}

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
