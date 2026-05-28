import { ConnectionNaming, type ConnectionIdentityResolver } from "@nile/core/models/connection";
import type { EndpointProfile, EndpointRegistryInput } from "@nile/core/models/endpoint";
import { splitEndpointUrl } from "@nile/core/projection/Url";
import type { StoredCredential } from "@nile/core/services/credential";
import type { OpenCodeOauthCredential } from "../OpenCodeAuthStore";
import type { OpenCodeDetectedAccess, OpenCodeDetectedEndpoint } from "../types";
import type { ResolvedLiveState } from "./Internal";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const OPENAI_HOST_MARKERS = ["api.openai.com"];
const AZURE_HOST_MARKERS = [".cognitiveservices.azure.com", ".openai.azure.com"];
const ANTHROPIC_HOST_MARKERS = ["api.anthropic.com"];

export class LiveSetupFactory {
  constructor(private readonly identityKeyResolver: ConnectionIdentityResolver) {
    void this.identityKeyResolver;
  }

  buildOpenAiSessionState(
    modelId: string,
    credential: OpenCodeOauthCredential,
  ): ResolvedLiveState {
    const sessionCredential: Extract<StoredCredential, { kind: "openai_session" }> = {
      kind: "openai_session",
      idToken: credential.access,
      accessToken: credential.access,
      refreshToken: credential.refresh,
      ...(credential.accountId?.trim() ? { accountId: credential.accountId.trim() } : {}),
    };
    const endpoint = this.buildOpenAiEndpoint("openai", "openai", DEFAULT_OPENAI_BASE_URL, "responses");
    const identityKey = this.identityKeyResolver.resolve("openai_session", sessionCredential) ?? undefined;
    const labelHint = `OpenAI Session ${modelId}`;

    return {
      endpoint,
      access: {
        authMode: "openai_session",
        label: labelHint,
        ...(identityKey ? { identityKey } : {}),
      },
      detectedEndpoint: {
        endpointFamily: "openai",
        endpointIdHint: endpoint.id,
        labelHint: endpoint.label,
        baseUrl: DEFAULT_OPENAI_BASE_URL,
        wireApi: "responses",
      },
      credential: sessionCredential,
      detectedAccess: {
        authMode: "openai_session",
        labelHint,
        ...(identityKey ? { identityKey } : {}),
      },
    };
  }

  buildOpenAiProviderState(
    providerId: string,
    modelId: string,
    baseUrl: string,
    credential: Extract<StoredCredential, { kind: "api_key" }>,
    wireApi: "chat" | "responses",
  ): ResolvedLiveState {
    const endpointFamily = this.inferOpenAiEndpointFamily(providerId, baseUrl);
    const envKey = credential.source === "env_key" ? credential.envKey : undefined;
    const endpoint = this.buildOpenAiEndpoint(providerId, endpointFamily, baseUrl, wireApi, envKey);
    const detectedEndpoint: OpenCodeDetectedEndpoint = {
      endpointFamily,
      endpointIdHint: providerId,
      labelHint: endpoint.label,
      baseUrl,
      wireApi,
      ...(envKey ? { envKey } : {}),
    };
    const detectedAccess: OpenCodeDetectedAccess = {
      authMode: "api_key",
      labelHint: `${endpoint.label} ${modelId}`,
    };

    return {
      endpoint,
      access: {
        authMode: "api_key",
        label: detectedAccess.labelHint,
      },
      detectedEndpoint,
      credential,
      detectedAccess,
    };
  }

  buildAnthropicProviderState(
    providerId: string,
    modelId: string,
    baseUrl: string,
    credential: Extract<StoredCredential, { kind: "api_key" }>,
    authScheme: "x_api_key" | "bearer",
    versionHeader?: string,
  ): ResolvedLiveState {
    const envKey = credential.source === "env_key" ? credential.envKey : undefined;
    const endpoint = this.buildAnthropicEndpoint(providerId, baseUrl, authScheme, envKey, versionHeader);
    const detectedEndpoint: OpenCodeDetectedEndpoint = {
      endpointFamily: "anthropic",
      endpointIdHint: providerId,
      labelHint: endpoint.label,
      baseUrl,
      ...(envKey ? { envKey } : {}),
    };
    const detectedAccess: OpenCodeDetectedAccess = {
      authMode: "api_key",
      labelHint: `${endpoint.label} ${modelId}`,
    };

    return {
      endpoint,
      access: {
        authMode: "api_key",
        label: detectedAccess.labelHint,
      },
      detectedEndpoint,
      credential,
      detectedAccess,
    };
  }

  private buildOpenAiEndpoint(
    endpointId: string,
    endpointFamily: OpenCodeDetectedEndpoint["endpointFamily"],
    baseUrl: string,
    wireApi: "chat" | "responses",
    envKey?: string,
  ): EndpointRegistryInput {
    const { rootUrl, path } = splitEndpointUrl(baseUrl);
    const profile: EndpointProfile =
      endpointFamily === "azure-openai"
        ? "azure-openai"
        : endpointFamily === "gateway"
          ? "generic-gateway"
          : "openai-official";

    return {
      id: endpointId,
      label: this.suggestOpenAiEndpointLabel(endpointFamily, rootUrl, baseUrl),
      rootUrl,
      profile,
      protocols: {
        openai: {
          ...(path ? { basePath: path } : {}),
          wireApis: [wireApi],
          authSchemes: ["bearer"],
          ...(envKey ? { envKeyOverride: envKey } : {}),
        },
      },
    };
  }

  private buildAnthropicEndpoint(
    endpointId: string,
    baseUrl: string,
    authScheme: "x_api_key" | "bearer",
    envKey?: string,
    versionHeader?: string,
  ): EndpointRegistryInput {
    const { rootUrl, path } = splitEndpointUrl(baseUrl);
    return {
      id: endpointId,
      label: this.suggestAnthropicEndpointLabel(rootUrl),
      rootUrl,
      profile: "anthropic-official",
      protocols: {
        anthropic: {
          ...(path ? { basePath: path } : {}),
          authSchemes: [authScheme],
          ...(envKey === "ANTHROPIC_API_KEY" || envKey === "ANTHROPIC_AUTH_TOKEN" ? { envKeyOverride: envKey } : {}),
          ...(versionHeader ? { versionHeader } : {}),
        },
      },
    };
  }

  private inferOpenAiEndpointFamily(
    providerId: string,
    baseUrl: string,
  ): OpenCodeDetectedEndpoint["endpointFamily"] {
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
    endpointFamily: OpenCodeDetectedEndpoint["endpointFamily"],
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
    return host && !ANTHROPIC_HOST_MARKERS.includes(host) ? `Anthropic (${host})` : "Anthropic";
  }
}
