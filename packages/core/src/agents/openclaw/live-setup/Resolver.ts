import { ConnectionIdentityKeyResolver } from "../../../models/connection";
import { CodexAuthStore } from "../../codex/stores/CodexAuthStore";
import type {
  OpenClawAuthProfileCredential,
} from "../AuthProfileStore";
import type { OpenClawDetectedAccess, OpenClawDetectedEndpoint } from "../types";
import type { ResolvedLiveState } from "./Internal";
import { LiveSetupFactory } from "./StateFactory";

type JsonObject = Record<string, unknown>;

export type OpenClawAuthProfileMode = "api_key" | "oauth" | "token";

export type OpenClawAuthProfileMetadata = {
  profileId: string;
  providerId: string;
  mode: OpenClawAuthProfileMode;
  email?: string;
};

export class LiveSetupResolver {
  private readonly stateFactory: LiveSetupFactory;

  constructor(
    private readonly codexAuthStore: CodexAuthStore,
    private readonly identityKeyResolver: ConnectionIdentityKeyResolver = new ConnectionIdentityKeyResolver(),
  ) {
    this.stateFactory = new LiveSetupFactory(this.identityKeyResolver);
  }

  resolveAuthProfileState(
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
      if (!this.stateFactory.matchesOpenAiProfileCredential(credential, codexCredential)) {
        return {
          error: `OpenClaw auth profile ${profile.profileId} does not match the current Codex OpenAI session`,
        };
      }

      return {
        value: this.stateFactory.buildOpenAiSessionState(modelId, codexCredential),
      };
    }

    if (profile.providerId === "openai") {
      const apiKey = this.readApiKeyValue(profile, credential);
      if ("error" in apiKey) {
        return apiKey;
      }

      return {
        value: this.stateFactory.buildOpenAiApiKeyState(modelId, apiKey.value),
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
          value: this.stateFactory.buildAnthropicSessionState(modelId, {
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
        value: this.stateFactory.buildAnthropicApiKeyState(modelId, apiKey.value, authScheme),
      };
    }

    return {
      error: `OpenClaw auth profile provider ${profile.providerId} is not supported by Nile`,
    };
  }

  resolveProviderState(
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
        value: this.stateFactory.buildOpenAiProviderState(providerId, modelId, baseUrl, apiKey, api),
      };
    }

    if (api === "anthropic-messages") {
      return {
        value: this.stateFactory.buildAnthropicProviderState(providerId, modelId, baseUrl, apiKey),
      };
    }

    return {
      error: `OpenClaw provider ${providerId} uses unsupported api protocol ${api}`,
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
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
