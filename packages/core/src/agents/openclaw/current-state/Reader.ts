import { ConnectionNaming } from "../../../models/connection/Naming";
import { ConnectionIdentityKeyResolver } from "../../../models/connection/setup/IdentityKeyResolver";
import type { EndpointProfile, EndpointRegistryInput } from "../../../models/endpoint";
import { splitEndpointUrl } from "../../../projection/Url";
import type {
  ClaudeSessionCredential,
  OpenAiSessionCredential,
  StoredCredential,
} from "../../../services/credential/Types";
import { CodexAuthStore } from "../../codex/stores/CodexAuthStore";
import {
  OpenClawAuthProfileStore,
  type OpenClawAuthProfileCredential,
} from "../AuthProfileStore";
import { OpenClawConfigStore } from "../OpenClawConfigStore";
import type { OpenClawDetectedAccess, OpenClawDetectedEndpoint } from "../types";
import type { ReadCurrentStateResult, ResolvedLiveState } from "./Internal";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const OPENAI_HOST_MARKERS = ["api.openai.com"];
const AZURE_HOST_MARKERS = [".cognitiveservices.azure.com", ".openai.azure.com"];
const ANTHROPIC_HOST_MARKERS = ["api.anthropic.com"];

type JsonObject = Record<string, unknown>;

type OpenClawAuthProfileMode = "api_key" | "oauth" | "token";

type OpenClawAuthProfileMetadata = {
  profileId: string;
  providerId: string;
  mode: OpenClawAuthProfileMode;
  email?: string;
};

export class CurrentStateReader {
  constructor(
    private readonly configStore: OpenClawConfigStore,
    private readonly authProfileStore: OpenClawAuthProfileStore,
    private readonly codexAuthStore: CodexAuthStore,
    private readonly identityKeyResolver: ConnectionIdentityKeyResolver = new ConnectionIdentityKeyResolver(),
  ) {}

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

    const authProfile = this.readAuthProfile(config, primary.providerId);
    if ("error" in authProfile) {
      return {
        kind: "invalid_semantics",
        issues: [authProfile.error],
        endpoint: null,
        access: null,
      };
    }

    if (authProfile.value) {
      let authStore: ReturnType<OpenClawAuthProfileStore["readParsedStore"]>;
      try {
        authStore = this.authProfileStore.readParsedStore();
      } catch (error) {
        return {
          kind: "invalid_structure",
          issues: [error instanceof Error ? error.message : String(error)],
        };
      }

      const credential = authStore.profiles[authProfile.value.profileId];
      if (!credential) {
        return {
          kind: "invalid_semantics",
          issues: [
            `OpenClaw auth-profiles.json does not contain profile ${authProfile.value.profileId}`,
          ],
          endpoint: null,
          access: null,
        };
      }

      const resolved = this.resolveAuthProfileState(
        authProfile.value,
        primary.modelId,
        credential,
      );
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

    const provider = this.readProvider(config, primary.providerId);
    if ("error" in provider) {
      return {
        kind: "invalid_semantics",
        issues: [provider.error],
        endpoint: null,
        access: null,
      };
    }

    const resolved = this.resolveProviderState(primary.providerId, primary.modelId, provider.value);
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

  private readAuthProfile(
    config: Record<string, unknown>,
    providerId: string,
  ): { value: OpenClawAuthProfileMetadata | null } | { error: string } {
    const auth = asObject(config.auth);
    const profiles = asObject(auth?.profiles);
    if (!profiles) {
      return { value: null };
    }

    const profileId = this.selectActiveProfileId(auth, profiles, providerId);
    if ("error" in profileId) {
      return profileId;
    }
    if (!profileId.value) {
      return { value: null };
    }

    const metadata = asObject(profiles[profileId.value]);
    if (!metadata) {
      return {
        error: `OpenClaw auth profile ${profileId.value} must be an object`,
      };
    }

    const profileProviderId = readString(metadata.provider);
    if (!profileProviderId) {
      return {
        error: `OpenClaw auth profile ${profileId.value} is missing provider`,
      };
    }
    if (profileProviderId !== providerId) {
      return {
        error: `OpenClaw auth profile ${profileId.value} targets provider ${profileProviderId}, expected ${providerId}`,
      };
    }

    const mode = readMode(metadata.mode);
    if (!mode) {
      return {
        error: `OpenClaw auth profile ${profileId.value} uses unsupported mode ${String(metadata.mode)}`,
      };
    }

    return {
      value: {
        profileId: profileId.value,
        providerId,
        mode,
        ...(readString(metadata.email) ? { email: readString(metadata.email)! } : {}),
      },
    };
  }

  private selectActiveProfileId(
    auth: JsonObject | null,
    profiles: JsonObject,
    providerId: string,
  ): { value: string | null } | { error: string } {
    const lastGoodId = readString(asObject(auth?.lastGood)?.[providerId]);
    if (lastGoodId && hasProfile(profiles, lastGoodId)) {
      return { value: lastGoodId };
    }

    const orderValues = asStringArray(asObject(auth?.order)?.[providerId]);
    const orderedProfileId = orderValues.find((profileId) => hasProfile(profiles, profileId));
    if (orderedProfileId) {
      return { value: orderedProfileId };
    }

    const matchingProfileIds = Object.entries(profiles)
      .filter(([, value]) => asObject(value)?.provider === providerId)
      .map(([profileId]) => profileId);

    if (matchingProfileIds.length === 0) {
      return { value: null };
    }
    if (matchingProfileIds.length > 1) {
      return {
        error: `OpenClaw config does not define an active auth profile for provider ${providerId}`,
      };
    }

    return { value: matchingProfileIds[0] };
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

  private resolveAuthProfileState(
    profile: OpenClawAuthProfileMetadata,
    modelId: string,
    credential: OpenClawAuthProfileCredential,
  ):
    | { value: ResolvedLiveState }
    | { error: string; endpoint?: OpenClawDetectedEndpoint; access?: OpenClawDetectedAccess } {
    if (credential.provider !== profile.providerId) {
      return {
        error: `OpenClaw auth profile ${profile.profileId} stores provider ${credential.provider}, expected ${profile.providerId}`,
      };
    }

    if (profile.providerId === "openai-codex") {
      if (profile.mode !== "oauth" || credential.type !== "oauth") {
        return {
          error: `OpenClaw provider ${profile.providerId} requires an oauth auth profile`,
        };
      }

      const codexCredential = this.codexAuthStore.readCredential();
      if (codexCredential?.kind !== "openai_session") {
        return {
          error: "OpenClaw uses OpenAI oauth, but Codex auth.json does not contain an OpenAI session",
        };
      }
      if (!this.matchesOpenAiProfileCredential(credential, codexCredential)) {
        return {
          error: `OpenClaw auth profile ${profile.profileId} does not match the current Codex OpenAI session`,
        };
      }

      return {
        value: this.buildOpenAiSessionState(modelId, codexCredential),
      };
    }

    if (profile.providerId === "openai") {
      const apiKey = this.readApiKeyValue(profile, credential);
      if ("error" in apiKey) {
        return apiKey;
      }

      return {
        value: this.buildOpenAiApiKeyState(modelId, apiKey.value),
      };
    }

    if (profile.providerId === "anthropic") {
      if (profile.mode === "oauth") {
        if (credential.type !== "oauth") {
          return {
            error: `OpenClaw auth profile ${profile.profileId} must store an oauth credential`,
          };
        }

        return {
          value: this.buildAnthropicSessionState(modelId, {
            kind: "claude_session",
            accessToken: credential.access,
            refreshToken: credential.refresh,
            expiresAt: credential.expires,
            ...(credential.accountId?.trim() ? { accountUuid: credential.accountId.trim() } : {}),
            ...((credential.email ?? profile.email)?.trim()
              ? { email: (credential.email ?? profile.email)!.trim() }
              : {}),
          }),
        };
      }

      const apiKey = this.readApiKeyValue(profile, credential);
      if ("error" in apiKey) {
        return apiKey;
      }

      const authScheme = profile.mode === "token" || credential.type === "token"
        ? "bearer"
        : "x_api_key";
      return {
        value: this.buildAnthropicApiKeyState(modelId, apiKey.value, authScheme),
      };
    }

    return {
      error: `OpenClaw auth profile provider ${profile.providerId} is not supported by Nile`,
    };
  }

  private readApiKeyValue(
    profile: OpenClawAuthProfileMetadata,
    credential: OpenClawAuthProfileCredential,
  ): { value: string } | { error: string; endpoint?: OpenClawDetectedEndpoint; access?: OpenClawDetectedAccess } {
    if (credential.type === "api_key") {
      const key = credential.key?.trim();
      if (!key) {
        return {
          error: `OpenClaw auth profile ${profile.profileId} is missing key`,
        };
      }
      return { value: key };
    }

    if (credential.type === "token") {
      const token = credential.token?.trim();
      if (!token) {
        return {
          error: `OpenClaw auth profile ${profile.profileId} is missing token`,
        };
      }
      return { value: token };
    }

    return {
      error: `OpenClaw auth profile ${profile.profileId} must store an api key or token credential`,
    };
  }

  private resolveProviderState(
    providerId: string,
    modelId: string,
    provider: JsonObject,
  ):
    | { value: ResolvedLiveState }
    | { error: string; endpoint?: OpenClawDetectedEndpoint; access?: OpenClawDetectedAccess } {
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
        value: this.buildOpenAiProviderState(providerId, modelId, baseUrl, apiKey, api),
      };
    }

    if (api === "anthropic-messages") {
      return {
        value: this.buildAnthropicProviderState(providerId, modelId, baseUrl, apiKey),
      };
    }

    return {
      error: `OpenClaw provider ${providerId} uses unsupported api protocol ${api}`,
    };
  }

  private buildOpenAiProviderState(
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

  private buildAnthropicProviderState(
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

  private buildOpenAiApiKeyState(modelId: string, apiKey: string): ResolvedLiveState {
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
        openclawModelId: modelId,
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
        openclawModelId: modelId,
      },
    };
  }

  private buildOpenAiSessionState(
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
        openclawModelId: modelId,
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
        openclawModelId: modelId,
        ...(identityKey ? { identityKey } : {}),
      },
    };
  }

  private buildAnthropicApiKeyState(
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
        openclawModelId: modelId,
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
        openclawModelId: modelId,
      },
    };
  }

  private buildAnthropicSessionState(
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
        openclawModelId: modelId,
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
        openclawModelId: modelId,
        ...(identityKey ? { identityKey } : {}),
      },
    };
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

  private matchesOpenAiProfileCredential(
    profile: Extract<OpenClawAuthProfileCredential, { type: "oauth" }>,
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

  private readOpenAiSessionEmail(credential: OpenAiSessionCredential): string | undefined {
    const claims = this.decodeJwtPayload(credential.idToken);
    const email = claims?.email;
    return typeof email === "string" && email.trim() ? email.trim() : undefined;
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    const parts = token.split(".");
    if (parts.length < 2) {
      return null;
    }

    try {
      const encoded = parts[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
      const payload = Buffer.from(encoded, "base64").toString("utf8");
      const parsed = JSON.parse(payload);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}

function hasProfile(profiles: JsonObject, profileId: string): boolean {
  return profileId in profiles && asObject(profiles[profileId]) !== null;
}

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readMode(value: unknown): OpenClawAuthProfileMode | null {
  return value === "api_key" || value === "oauth" || value === "token"
    ? value
    : null;
}
