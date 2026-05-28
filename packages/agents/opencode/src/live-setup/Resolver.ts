import type { OpenCodeOauthCredential } from "../OpenCodeAuthStore";
import { CONNECTION_RUNTIME_REGISTRY } from "@nile/core/models/connection";
import type { StoredCredential } from "@nile/core/services/credential";
import type { OpenCodeDetectedAccess, OpenCodeDetectedEndpoint } from "../types";
import type { ResolvedLiveState } from "./Internal";
import { LiveSetupFactory } from "./StateFactory";

type JsonObject = Record<string, unknown>;

export class LiveSetupResolver {
  private readonly stateFactory: LiveSetupFactory;

  constructor() {
    this.stateFactory = new LiveSetupFactory(CONNECTION_RUNTIME_REGISTRY.read().createIdentityResolver());
  }

  resolveOpenAiOauthState(
    modelId: string,
    credential: OpenCodeOauthCredential,
  ): ResolvedLiveState {
    return this.stateFactory.buildOpenAiSessionState(modelId, credential);
  }

  resolveProviderState(
    providerId: string,
    modelId: string,
    provider: JsonObject,
  ):
    | { value: ResolvedLiveState }
    | { error: string; endpoint?: OpenCodeDetectedEndpoint; access?: OpenCodeDetectedAccess } {
    const npm = readString(provider.npm);
    if (!npm) {
      return { error: `OpenCode provider ${providerId} is missing npm` };
    }

    const options = asObject(provider.options);
    const apiKeyValue = readString(options?.apiKey);
    if (!apiKeyValue) {
      return { error: `OpenCode provider ${providerId} is missing options.apiKey` };
    }

    const credential = this.readCredential(apiKeyValue);

    if (npm === "@ai-sdk/openai") {
      return {
        value: this.stateFactory.buildOpenAiProviderState(
          providerId,
          modelId,
          readString(options?.baseURL) ?? "https://api.openai.com/v1",
          credential,
          "responses",
        ),
      };
    }

    if (npm === "@ai-sdk/openai-compatible") {
      const baseUrl = readString(options?.baseURL);
      if (!baseUrl) {
        return { error: `OpenCode provider ${providerId} is missing options.baseURL` };
      }

      return {
        value: this.stateFactory.buildOpenAiProviderState(
          providerId,
          modelId,
          baseUrl,
          credential,
          "chat",
        ),
      };
    }

    if (npm === "@ai-sdk/anthropic") {
      return {
        value: this.stateFactory.buildAnthropicProviderState(
          providerId,
          modelId,
          readString(options?.baseURL) ?? "https://api.anthropic.com",
          credential,
          this.readAnthropicAuthScheme(asObject(options?.headers)),
          readString(asObject(options?.headers)?.["anthropic-version"]) ?? undefined,
        ),
      };
    }

    return {
      error: `OpenCode provider ${providerId} uses unsupported npm package ${npm}`,
    };
  }

  private readCredential(value: string): Extract<StoredCredential, { kind: "api_key" }> {
    const envMatch = /^\{env:([A-Z_][A-Z0-9_]*)\}$/.exec(value.trim());
    if (envMatch) {
      return {
        kind: "api_key",
        source: "env_key",
        envKey: envMatch[1],
      };
    }

    return {
      kind: "api_key",
      source: "direct",
      apiKey: value.trim(),
    };
  }

  private readAnthropicAuthScheme(headers: JsonObject | null): "x_api_key" | "bearer" {
    const authorization = readString(headers?.Authorization);
    return authorization?.toLowerCase().startsWith("bearer ") ? "bearer" : "x_api_key";
  }
}

function asObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
