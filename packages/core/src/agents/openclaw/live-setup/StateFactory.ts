import {
  ConnectionIdentityKeyResolver,
  ConnectionNaming,
} from "../../../models/connection";
import type { EndpointProfile, EndpointRegistryInput } from "../../../models/endpoint";
import { splitEndpointUrl } from "../../../projection/Url";
import type {
  ClaudeSessionCredential,
  OpenAiSessionCredential,
} from "../../../services/credential/Types";
import { JWT_PAYLOAD_DECODER } from "../../../services/JwtPayloadDecoder";
import type { OpenClawDetectedAccess, OpenClawDetectedEndpoint } from "../types";
import type { ResolvedLiveState } from "./Internal";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const OPENAI_HOST_MARKERS = ["api.openai.com"];
const AZURE_HOST_MARKERS = [".cognitiveservices.azure.com", ".openai.azure.com"];
const ANTHROPIC_HOST_MARKERS = ["api.anthropic.com"];

export class LiveSetupFactory {
  constructor(
    private readonly identityKeyResolver: ConnectionIdentityKeyResolver = new ConnectionIdentityKeyResolver(),
  ) {}

  buildOpenAiProviderState(
    providerId: string,
    modelId: string,
    baseUrl: string,
    apiKey: string,
    api: "openai-completions" | "openai-responses",
  ): ResolvedLiveState {
    const endpointFamily = this.inferOpenAiEndpointFamily(providerId, baseUrl);
    const endpoint = this.buildOpenAiEndpoint(
      providerId,
      endpointFamily,
      baseUrl,
      api === "openai-completions" ? "chat" : "responses",
    );
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
    };

    return {
      endpoint,
      access: {
        authMode: "api_key",
        label: detectedAccess.labelHint,
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

  buildAnthropicProviderState(
    providerId: string,
    modelId: string,
    baseUrl: string,
    apiKey: string,
  ): ResolvedLiveState {
    const endpoint = this.buildAnthropicEndpoint(providerId, baseUrl, "x_api_key");
    const detectedEndpoint: OpenClawDetectedEndpoint = {
      endpointFamily: "anthropic",
      endpointIdHint: providerId,
      labelHint: endpoint.label,
      baseUrl,
    };
    const detectedAccess: OpenClawDetectedAccess = {
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
      credential: {
        kind: "api_key",
        source: "direct",
        apiKey,
      },
      detectedAccess,
    };
  }

  buildOpenAiApiKeyState(modelId: string, apiKey: string): ResolvedLiveState {
    const endpoint = this.buildOpenAiEndpoint(
      "openai",
      "openai",
      DEFAULT_OPENAI_BASE_URL,
      "responses",
    );
    const labelHint = `${endpoint.label} ${modelId}`;
    return {
      endpoint,
      access: {
        authMode: "api_key",
        label: labelHint,
      },
      detectedEndpoint: {
        endpointFamily: "openai",
        endpointIdHint: endpoint.id,
        labelHint: endpoint.label,
        baseUrl: DEFAULT_OPENAI_BASE_URL,
        wireApi: "responses",
      },
      credential: {
        kind: "api_key",
        source: "direct",
        apiKey,
      },
      detectedAccess: {
        authMode: "api_key",
        labelHint,
      },
    };
  }

  buildOpenAiSessionState(
    modelId: string,
    credential: OpenAiSessionCredential,
  ): ResolvedLiveState {
    const endpoint = this.buildOpenAiEndpoint(
      "openai",
      "openai",
      DEFAULT_OPENAI_BASE_URL,
      "responses",
    );
    const identityKey = this.identityKeyResolver.resolve("openai_session", credential) ?? undefined;
    const email = this.readOpenAiSessionEmail(credential);
    const labelHint = `${email ?? "OpenAI Session"} ${modelId}`;

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
      credential,
      detectedAccess: {
        authMode: "openai_session",
        labelHint,
        ...(identityKey ? { identityKey } : {}),
      },
    };
  }

  buildOpenAiSessionProfileState(
    modelId: string,
    credential: {
      accessToken: string;
      refreshToken: string;
      expiresAt?: number;
      accountId?: string;
      email?: string;
    },
  ): ResolvedLiveState {
    const endpoint = this.buildOpenAiEndpoint(
      "openai",
      "openai",
      DEFAULT_OPENAI_BASE_URL,
      "responses",
    );
    const identityKey = this.readOpenAiSessionIdentityKey(credential.accountId, credential.email);
    const email = credential.email?.trim();
    const labelHint = `${email || "OpenAI Session"} ${modelId}`;

    return {
      endpoint,
      access: {
        authMode: "openclaw_openai_session",
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
      credential: {
        kind: "openclaw_openai_session",
        accessToken: credential.accessToken,
        refreshToken: credential.refreshToken,
        ...(typeof credential.expiresAt === "number" ? { expiresAt: credential.expiresAt } : {}),
        ...(credential.accountId?.trim() ? { accountId: credential.accountId.trim() } : {}),
        ...(credential.email?.trim() ? { email: credential.email.trim() } : {}),
      },
      detectedAccess: {
        authMode: "openclaw_openai_session",
        labelHint,
        ...(identityKey ? { identityKey } : {}),
      },
    };
  }

  buildAnthropicApiKeyState(
    modelId: string,
    apiKey: string,
    authScheme: "x_api_key" | "bearer",
  ): ResolvedLiveState {
    const endpoint = this.buildAnthropicEndpoint("anthropic", DEFAULT_ANTHROPIC_BASE_URL, authScheme);
    const labelHint = `${endpoint.label} ${modelId}`;
    return {
      endpoint,
      access: {
        authMode: "api_key",
        label: labelHint,
      },
      detectedEndpoint: {
        endpointFamily: "anthropic",
        endpointIdHint: endpoint.id,
        labelHint: endpoint.label,
        baseUrl: DEFAULT_ANTHROPIC_BASE_URL,
      },
      credential: {
        kind: "api_key",
        source: "direct",
        apiKey,
      },
      detectedAccess: {
        authMode: "api_key",
        labelHint,
      },
    };
  }

  buildAnthropicSessionState(
    modelId: string,
    credential: ClaudeSessionCredential,
  ): ResolvedLiveState {
    const endpoint = this.buildAnthropicEndpoint("anthropic", DEFAULT_ANTHROPIC_BASE_URL, "x_api_key");
    const identityKey = this.identityKeyResolver.resolve("claude_session", credential) ?? undefined;
    const labelHint = `${credential.email?.trim() || "Claude Session"} ${modelId}`;

    return {
      endpoint,
      access: {
        authMode: "claude_session",
        label: labelHint,
        ...(identityKey ? { identityKey } : {}),
      },
      detectedEndpoint: {
        endpointFamily: "anthropic",
        endpointIdHint: endpoint.id,
        labelHint: endpoint.label,
        baseUrl: DEFAULT_ANTHROPIC_BASE_URL,
      },
      credential,
      detectedAccess: {
        authMode: "claude_session",
        labelHint,
        ...(identityKey ? { identityKey } : {}),
      },
    };
  }

  matchesOpenAiProfileCredential(
    profile: { accountId?: string; email?: string },
    credential: OpenAiSessionCredential,
  ): boolean {
    const profileAccountId = profile.accountId?.trim();
    if (profileAccountId) {
      return credential.accountId?.trim() === profileAccountId;
    }

    const profileEmail = profile.email?.trim().toLowerCase();
    if (!profileEmail) {
      return true;
    }

    const credentialEmail = this.readOpenAiSessionEmail(credential)?.toLowerCase();
    return !credentialEmail || credentialEmail === profileEmail;
  }

  private buildOpenAiEndpoint(
    endpointId: string,
    endpointFamily: OpenClawDetectedEndpoint["endpointFamily"],
    baseUrl: string,
    wireApi: "chat" | "responses",
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
        },
      },
    };
  }

  private buildAnthropicEndpoint(
    endpointId: string,
    baseUrl: string,
    authScheme: "x_api_key" | "bearer",
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
    return host && !ANTHROPIC_HOST_MARKERS.includes(host) ? `Anthropic (${host})` : "Anthropic";
  }

  private readOpenAiSessionEmail(credential: OpenAiSessionCredential): string | undefined {
    const claims = this.decodeJwtPayload(credential.idToken);
    const email = claims?.email;
    return typeof email === "string" && email.trim() ? email.trim() : undefined;
  }

  private readOpenAiSessionIdentityKey(accountId?: string, email?: string): string | undefined {
    const normalizedAccountId = accountId?.trim();
    if (normalizedAccountId) {
      return `account:${normalizedAccountId}`;
    }
    const normalizedEmail = email?.trim();
    if (normalizedEmail) {
      return `identity:${normalizedEmail}`;
    }
    return undefined;
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    return JWT_PAYLOAD_DECODER.decode(token);
  }
}
