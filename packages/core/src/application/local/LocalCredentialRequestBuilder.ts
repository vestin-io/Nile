import type { AuthMode } from "../../models/access/AuthMode";
import type { CurrentSessionSourceId } from "../../models/connection/SourceTypes";
import type { LocalCredentialRequest } from "./CredentialRequest";
import { SessionCredentialRequestBuilder } from "../../session";

type LocalCredentialRequestInput = {
  authMode: AuthMode;
  apiKeySource?: "direct" | "env_key";
  apiKey?: string;
  envKey?: string;
  sessionSource?: "login" | CurrentSessionSourceId;
  sessionAuthJsonPath?: string;
};

type LocalCredentialRequestUpdateInput = Omit<LocalCredentialRequestInput, "authMode">;

export class LocalCredentialRequestBuilder {
  private readonly sessionRequestBuilder = new SessionCredentialRequestBuilder();

  build(input: LocalCredentialRequestInput): LocalCredentialRequest {
    if (input.authMode === "api_key") {
      return input.apiKeySource === "env_key"
        ? this.buildApiKeyEnvKey(input.envKey ?? "")
        : this.buildApiKeyDirect(input.apiKey ?? "", input.envKey);
    }

    if (input.authMode === "openclaw_openai_session") {
      throw new Error("Unsupported auth mode for local credential request build: openclaw_openai_session");
    }
    return this.sessionRequestBuilder.build(input.authMode, input.sessionSource, {
      authJsonPath: input.sessionAuthJsonPath,
    });
  }

  buildUpdate(
    authMode: AuthMode,
    input: LocalCredentialRequestUpdateInput,
  ): LocalCredentialRequest | undefined {
    if (authMode === "api_key") {
      if (input.apiKeySource === "env_key") {
        const envKey = input.envKey?.trim();
        return envKey ? this.buildApiKeyEnvKey(envKey) : undefined;
      }

      const apiKey = input.apiKey?.trim();
      return apiKey ? this.buildApiKeyDirect(apiKey, input.envKey) : undefined;
    }

    if (authMode === "openclaw_openai_session") {
      return undefined;
    }
    return this.sessionRequestBuilder.buildUpdate(authMode, input.sessionSource, {
      authJsonPath: input.sessionAuthJsonPath?.trim() || undefined,
    });
  }

  buildApiKeyDirect(apiKey: string, envKey?: string): LocalCredentialRequest {
    return {
      authMode: "api_key",
      source: "direct",
      apiKey,
      ...(envKey?.trim() ? { envKey: envKey.trim() } : {}),
    };
  }

  buildApiKeyEnvKey(envKey: string): LocalCredentialRequest {
    return {
      authMode: "api_key",
      source: "env_key",
      envKey,
    };
  }
}
