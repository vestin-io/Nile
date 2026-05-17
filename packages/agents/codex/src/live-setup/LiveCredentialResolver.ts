import type {
  ApiKeyCredential,
  OpenAiSessionCredential,
  StoredCredential,
} from "@nile/core/services/credential";
import { isDirectApiKeyCredential } from "@nile/core/services/credential";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import type {
  CodexLiveCredential,
  CodexEndpointFamily,
} from "./Internal";

export class LiveCredentialResolver {
  constructor(private readonly environment: EnvironmentSource) {}

  resolve(
    endpointFamily: CodexEndpointFamily,
    envKey: string | undefined,
    authCredential: StoredCredential | null,
  ): { value: CodexLiveCredential } | { error: string } {
    const envCredential = this.resolveEnvBackedApiKey(envKey, authCredential);

    if (envKey && !envCredential) {
      return {
        error: `Codex live state is configured to use env key ${envKey}, but Nile could not read a key`,
      };
    }

    if (endpointFamily === "azure-openai" || endpointFamily === "gateway") {
      if (!envCredential) {
        return { error: `Codex live state requires an API key for ${endpointFamily}` };
      }
      return { value: envCredential };
    }

    if (envKey) {
      return { value: envCredential as ApiKeyCredential };
    }

    if (!authCredential) {
      return { error: "Codex live state does not contain any readable auth credential" };
    }

    if (authCredential.kind !== "openai_session" && authCredential.kind !== "api_key") {
      return { error: "Codex live state contains an unsupported credential shape" };
    }

    return { value: authCredential };
  }

  private resolveEnvBackedApiKey(
    envKey: string | undefined,
    authCredential: StoredCredential | null,
  ): ApiKeyCredential | null {
    const envValue = this.environment.read(envKey);
    if (envValue) {
      return {
        kind: "api_key",
        source: "direct",
        apiKey: envValue,
      };
    }

    if (authCredential && isDirectApiKeyCredential(authCredential) && (!envKey || envKey === "OPENAI_API_KEY")) {
      return authCredential;
    }

    return null;
  }
}
