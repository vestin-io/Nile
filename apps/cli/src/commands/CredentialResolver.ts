import {
  type AuthMode,
  SUPPORTED_AUTH_MODES,
} from "@nile/core/models/access";
import { LocalCredentialRequestBuilder, LocalCredentialResolver } from "@nile/core/application/local";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import type { StoredCredential } from "@nile/core/services/credential";
import { CodexSessionLogin } from "@nile/core/agents";

import { InteractivePrompt } from "../InteractivePrompt";
import type { ResolvedCliOptions } from "../types";

export class ConnectionCredentialResolver {
  private readonly requestBuilder = new LocalCredentialRequestBuilder();

  constructor(
    private readonly prompt: InteractivePrompt,
    private readonly loginRunner: CodexSessionLogin,
  ) {}

  async resolveForFlags(
    options: ResolvedCliOptions,
    flags: Map<string, string | boolean>,
    authMode: AuthMode,
  ): Promise<StoredCredential> {
    const resolver = this.createCredentialResolver(options);
    if (authMode === "api_key") {
      const apiKey = this.getFlagString(flags, "api-key");
      if (!apiKey) {
        throw new Error("nile add with api_key requires --api-key");
      }
      return resolver.resolve(this.requestBuilder.buildApiKeyDirect(apiKey));
    }

    if (authMode === "openai_session") {
      if (this.hasFlag(flags, "login")) {
        return await resolver.resolveAsync(this.requestBuilder.buildOpenAiSession("login"));
      }
      if (!this.hasFlag(flags, "from-codex-current")) {
        throw new Error("nile add with openai_session requires --login or --from-codex-current");
      }
      return resolver.resolve(this.requestBuilder.buildOpenAiSession("current_codex"));
    }

    if (authMode === "cursor_session") {
      if (!this.hasFlag(flags, "from-cursor-current")) {
        throw new Error("nile add with cursor_session requires --from-cursor-current");
      }
      return resolver.resolve(this.requestBuilder.buildCursorSession());
    }

    if (authMode === "claude_session") {
      if (!this.hasFlag(flags, "from-claude-current")) {
        throw new Error("nile add with claude_session requires --from-claude-current");
      }
      return resolver.resolve(this.requestBuilder.buildClaudeSession("current_claude"));
    }

    throw new Error(`Unsupported auth mode: ${authMode}`);
  }

  async promptForCredential(
    options: ResolvedCliOptions,
    authMode: AuthMode,
  ): Promise<StoredCredential> {
    const resolver = this.createCredentialResolver(options);
    if (authMode === "api_key") {
      while (true) {
        const input = await this.prompt.input("API key", {
          allowBack: true,
          allowCancel: true,
          secret: true,
        });
        if (input.type === "cancel") {
          throw new Error("Cancelled");
        }
        if (input.type === "back") {
          throw new Error("Back");
        }
        if (input.value) {
          return resolver.resolve(this.requestBuilder.buildApiKeyDirect(input.value));
        }
      }
    }

    if (authMode === "openai_session") {
      const selection = await this.prompt.select(
        "How should Nile read the OpenAI session?",
        [
          { value: "sign_in", label: "Sign in with OpenAI" },
          { value: "codex_current", label: "Import current Codex auth" },
        ],
        { allowBack: true, allowCancel: true },
      );
      if (selection.type === "cancel") {
        throw new Error("Cancelled");
      }
      if (selection.type === "back") {
        throw new Error("Back");
      }
      if (selection.value === "sign_in") {
        return await resolver.resolveAsync(this.requestBuilder.buildOpenAiSession("login"));
      }
      return resolver.resolve(this.requestBuilder.buildOpenAiSession("current_codex"));
    }

    if (authMode === "cursor_session") {
      return resolver.resolve(this.requestBuilder.buildCursorSession());
    }

    if (authMode === "claude_session") {
      return resolver.resolve(this.requestBuilder.buildClaudeSession("current_claude"));
    }

    throw new Error(`Unsupported auth mode for CLI onboarding: ${authMode}`);
  }

  formatAuthModeLabel(authMode: AuthMode): string {
    if (authMode === "openai_session") {
      return "Use OpenAI session";
    }
    if (authMode === "api_key") {
      return "Use API key";
    }
    if (authMode === "cursor_session") {
      return "Import current Cursor session";
    }
    if (authMode === "claude_session") {
      return "Import current Claude session";
    }
    return authMode;
  }

  requireAuthMode(authMode: string): AuthMode {
    if (!SUPPORTED_AUTH_MODES.includes(authMode as AuthMode)) {
      throw new Error(`Unsupported auth mode: ${authMode}`);
    }
    return authMode as AuthMode;
  }

  private getFlagString(flags: Map<string, string | boolean>, name: string): string | null {
    const value = flags.get(name);
    return typeof value === "string" ? value : null;
  }

  private hasFlag(flags: Map<string, string | boolean>, name: string): boolean {
    return flags.has(name);
  }

  private createCredentialResolver(options: ResolvedCliOptions): LocalCredentialResolver {
    return new LocalCredentialResolver(
      options.agentHomes,
      options.environment ?? EnvironmentSource.empty(),
      this.loginRunner,
    );
  }
}
