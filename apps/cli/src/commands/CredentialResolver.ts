import {
  type AuthMode,
  SUPPORTED_AUTH_MODES,
} from "@nile/core/models/access";
import {
  LocalCredentialRequestBuilder,
  LocalCredentialResolver,
} from "@nile/builtins/local";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import type { StoredCredential } from "@nile/core/services/credential";
import {
  INTERACTIVE_SESSION_LOGIN_REGISTRY,
  SHARED_SESSION_CONNECTION_METHODS,
  type SessionConnectionAuthMode,
  type InteractiveSessionLoginRegistry,
} from "@nile/builtins/session";

import { InteractivePrompt } from "../InteractivePrompt";
import type { ResolvedCliOptions } from "../types";

export class ConnectionCredentialResolver {
  private readonly requestBuilder = new LocalCredentialRequestBuilder();

  constructor(
    private readonly prompt: InteractivePrompt,
    private readonly interactiveSessionLoginRegistry: Pick<
      InteractiveSessionLoginRegistry,
      "signInAndRead"
    > = INTERACTIVE_SESSION_LOGIN_REGISTRY,
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

    const sessionMethod = SHARED_SESSION_CONNECTION_METHODS.isSessionAuthMode(authMode)
      ? this.readFlagSessionMethod(authMode, flags)
      : null;
    if (sessionMethod) {
      const request = this.requestBuilder.build({
        authMode,
        sessionSource: sessionMethod.source,
      });
      return sessionMethod.source === "login"
        ? await resolver.resolveAsync(request)
        : resolver.resolve(request);
    }

    if (!SHARED_SESSION_CONNECTION_METHODS.isSessionAuthMode(authMode)) {
      throw new Error(`Unsupported auth mode for CLI credential resolution: ${authMode}`);
    }

    const supportedFlags = SHARED_SESSION_CONNECTION_METHODS.readSupportedCliFlags(authMode)
      .map((flag) => `--${flag}`)
      .join(" or ");
    throw new Error(`nile add with ${authMode} requires ${supportedFlags}`);
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

    if (!SHARED_SESSION_CONNECTION_METHODS.isSessionAuthMode(authMode)) {
      throw new Error(`Unsupported auth mode for CLI credential prompt: ${authMode}`);
    }

    const visibleMethods = SHARED_SESSION_CONNECTION_METHODS.listVisibleForPrompt(authMode);
    if (visibleMethods.length > 1) {
      const selection = await this.prompt.select(
        "Choose how Nile should read this session",
        visibleMethods.map((method) => ({
          value: SHARED_SESSION_CONNECTION_METHODS.readPromptValue(method),
          label: method.promptLabel ?? method.key,
        })),
        { allowBack: true, allowCancel: true },
      );
      if (selection.type === "cancel") {
        throw new Error("Cancelled");
      }
      if (selection.type === "back") {
        throw new Error("Back");
      }
      const method = SHARED_SESSION_CONNECTION_METHODS.findByPromptValue(authMode, selection.value);
      if (!method) {
        throw new Error(`Unsupported session method selection: ${selection.value}`);
      }
      return method.source === "login"
        ? await resolver.resolveAsync(this.requestBuilder.build({ authMode, sessionSource: method.source }))
        : resolver.resolve(this.requestBuilder.build({ authMode, sessionSource: method.source }));
    }

    const method = visibleMethods[0] ?? SHARED_SESSION_CONNECTION_METHODS.readDefault(authMode);
    return method.source === "login"
      ? await resolver.resolveAsync(this.requestBuilder.build({ authMode, sessionSource: method.source }))
      : resolver.resolve(this.requestBuilder.build({ authMode, sessionSource: method.source }));
  }

  private readFlagSessionMethod(authMode: SessionConnectionAuthMode, flags: Map<string, string | boolean>) {
    for (const flag of SHARED_SESSION_CONNECTION_METHODS.readSupportedCliFlags(authMode)) {
      if (this.hasFlag(flags, flag)) {
        return SHARED_SESSION_CONNECTION_METHODS.findByCliFlag(authMode, flag);
      }
    }
    return null;
  }

  formatAuthModeLabel(authMode: AuthMode): string {
    const defaultMethod = SHARED_SESSION_CONNECTION_METHODS.readDefaultForAuthMode(authMode);
    if (defaultMethod?.promptLabel) {
      return defaultMethod.promptLabel;
    }
    if (authMode === "openclaw_openai_session") {
      return "Use OpenClaw OpenAI session";
    }
    if (authMode === "api_key") {
      return "Use API key";
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
      this.interactiveSessionLoginRegistry,
    );
  }
}
