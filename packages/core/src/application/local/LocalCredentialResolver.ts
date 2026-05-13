import type { AgentHomes } from "../../models/agent/Homes";
import { resolveAgentHome } from "../../models/agent/Homes";
import type {
  ClaudeSessionCredential,
  OpenAiSessionCredential,
  StoredCredential,
} from "../../services/credential/Types";
import { type EnvironmentSource } from "../../services/EnvironmentSource";
import { ClaudeSessionLogin, CurrentCredentialReader as ClaudeCurrentCredentialReader } from "../../agents/claude";
import { CurrentCredentialReader as CursorCurrentCredentialReader } from "../../agents/cursor";
import { CodexCurrentCredentialReader, CodexSessionLogin } from "../../agents/codex";

export type LocalCredentialRequest =
  | {
      authMode: "api_key";
      source?: "direct";
      apiKey: string;
      envKey?: string;
    }
  | {
      authMode: "api_key";
      source: "env_key";
      envKey: string;
    }
  | {
      authMode: "openai_session";
      authJsonPath?: string;
      source: "current_codex" | "login";
    }
  | {
      authMode: "claude_session";
      source: "current_claude" | "login";
    }
  | {
      authMode: "cursor_session";
      source: "current_cursor";
    };

export class LocalCredentialResolver {
  constructor(
    private readonly agentHomes: AgentHomes | undefined,
    private readonly environment: EnvironmentSource,
    private readonly codexSessionLogin: CodexSessionLogin = new CodexSessionLogin(),
    private readonly claudeSessionLogin: ClaudeSessionLogin = new ClaudeSessionLogin(),
  ) {}

  resolve(request: LocalCredentialRequest): StoredCredential {
    if (request.authMode === "api_key") {
      return request.source === "env_key"
        ? this.resolveApiKeyEnvKey(request.envKey)
        : this.resolveApiKey(request.apiKey, request.envKey);
    }

    if (request.authMode === "openai_session") {
      if (request.source === "login") {
        throw new Error("OpenAI session login requires async resolution");
      }
      return this.resolveOpenAiSession(request.source, request.authJsonPath);
    }

    if (request.authMode === "claude_session") {
      if (request.source === "login") {
        throw new Error("Claude session login requires async resolution");
      }
      return this.resolveClaudeSession(request.source);
    }

    return this.resolveCurrentCursorCredential();
  }

  async resolveAsync(request: LocalCredentialRequest): Promise<StoredCredential> {
    if (request.authMode === "openai_session" && request.source === "login") {
      return await this.resolveOpenAiSessionWithLogin(request.authJsonPath);
    }

    if (request.authMode === "claude_session" && request.source === "login") {
      return await this.resolveClaudeSessionWithLogin();
    }

    return this.resolve(request);
  }

  resolveProbeCredential(request: LocalCredentialRequest): StoredCredential {
    if (request.authMode !== "api_key") {
      return this.resolve(request);
    }

    if (request.source === "env_key") {
      const envKey = request.envKey.trim();
      if (!envKey) {
        throw new Error("Environment variable name is required");
      }
      const apiKey = this.environment.read(envKey);
      if (!apiKey?.trim()) {
        throw new Error(`Environment variable ${envKey} is empty or not available`);
      }
      return this.resolveApiKey(apiKey);
    }

    return this.resolve(request);
  }

  private resolveApiKey(apiKey: string, envKey?: string): StoredCredential {
    const normalized = apiKey.trim();
    if (!normalized) {
      throw new Error("API key is required");
    }

    return {
      kind: "api_key",
      source: "direct",
      apiKey: normalized,
      ...(envKey?.trim() ? { envKey: envKey.trim() } : {}),
    };
  }

  private resolveApiKeyEnvKey(envKey: string): StoredCredential {
    const normalized = envKey.trim();
    if (!normalized) {
      throw new Error("Environment variable name is required");
    }

    return {
      kind: "api_key",
      source: "env_key",
      envKey: normalized,
    };
  }

  private resolveOpenAiSession(
    source: "current_codex" | "login",
    authJsonPath?: string,
  ): OpenAiSessionCredential {
    const codexHome = resolveAgentHome("codex", this.agentHomes);
    const credential = CodexCurrentCredentialReader.open({
        codexHome,
        authPath: authJsonPath?.trim() || undefined,
      }).read();

    if (credential.kind !== "openai_session") {
      throw new Error("No OpenAI session found in current Codex setup");
    }

    return credential;
  }

  private async resolveOpenAiSessionWithLogin(authJsonPath?: string): Promise<OpenAiSessionCredential> {
    const codexHome = resolveAgentHome("codex", this.agentHomes);
    const credential = await this.codexSessionLogin.signInAndRead(codexHome);
    if (credential.kind !== "openai_session") {
      throw new Error("No OpenAI session found after Codex sign-in");
    }
    if (authJsonPath?.trim()) {
      return this.resolveOpenAiSession("current_codex", authJsonPath);
    }
    return credential;
  }

  private resolveCurrentClaudeCredential(): ClaudeSessionCredential {
    const claudeHome = resolveAgentHome("claude", this.agentHomes);
    const credential = ClaudeCurrentCredentialReader.open({ claudeHome }).read();
    if (credential.kind !== "claude_session") {
      throw new Error("No Claude session found in current Claude setup");
    }

    return credential;
  }

  private resolveClaudeSession(source: "current_claude" | "login"): ClaudeSessionCredential {
    return this.resolveCurrentClaudeCredential();
  }

  private async resolveClaudeSessionWithLogin(): Promise<ClaudeSessionCredential> {
    const claudeHome = resolveAgentHome("claude", this.agentHomes);
    const credential = await this.claudeSessionLogin.signInAndRead(claudeHome);
    if (credential.kind !== "claude_session") {
      throw new Error("No Claude session found after Claude sign-in");
    }
    return credential;
  }

  private resolveCurrentCursorCredential(): StoredCredential {
    const cursorHome = resolveAgentHome("cursor", this.agentHomes);
    return CursorCurrentCredentialReader.open({
      cursorHome,
      environment: this.environment,
    }).read();
  }
}
