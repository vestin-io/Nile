import type { AuthMode } from "../../models/access/AuthMode";

import type { LocalCredentialRequest } from "./LocalCredentialResolver";

type LocalCredentialRequestInput = {
  authMode: AuthMode;
  apiKeySource?: "direct" | "env_key";
  apiKey?: string;
  envKey?: string;
  openAiSessionSource?: "login" | "current_codex";
  openAiAuthJsonPath?: string;
  claudeSessionSource?: "login" | "current_claude";
};

type LocalCredentialRequestUpdateInput = Omit<LocalCredentialRequestInput, "authMode">;

export class LocalCredentialRequestBuilder {
  build(input: LocalCredentialRequestInput): LocalCredentialRequest {
    if (input.authMode === "api_key") {
      return input.apiKeySource === "env_key"
        ? this.buildApiKeyEnvKey(input.envKey ?? "")
        : this.buildApiKeyDirect(input.apiKey ?? "", input.envKey);
    }

    if (input.authMode === "openai_session") {
      return this.buildOpenAiSession(
        input.openAiSessionSource === "current_codex" ? "current_codex" : "login",
        input.openAiAuthJsonPath,
      );
    }

    if (input.authMode === "claude_session") {
      return this.buildClaudeSession(
        input.claudeSessionSource === "login" ? "login" : "current_claude",
      );
    }

    return this.buildCursorSession();
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

    if (authMode === "openai_session") {
      if (!input.openAiSessionSource) {
        return undefined;
      }
      return this.buildOpenAiSession(input.openAiSessionSource, input.openAiAuthJsonPath?.trim() || undefined);
    }

    if (authMode === "claude_session") {
      return input.claudeSessionSource
        ? this.buildClaudeSession(input.claudeSessionSource)
        : undefined;
    }

    return undefined;
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

  buildOpenAiSession(
    source: "login" | "current_codex",
    authJsonPath?: string,
  ): LocalCredentialRequest {
    return {
      authMode: "openai_session",
      source,
      ...(authJsonPath ? { authJsonPath } : {}),
    };
  }

  buildClaudeSession(
    source: "login" | "current_claude",
  ): LocalCredentialRequest {
    return {
      authMode: "claude_session",
      source,
    };
  }

  buildCursorSession(): LocalCredentialRequest {
    return {
      authMode: "cursor_session",
      source: "current_cursor",
    };
  }
}
