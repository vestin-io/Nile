import type { AuthMode } from "@nile/core/models/access";
import type { CurrentSessionSourceId } from "@nile/core/models/connection/SourceTypes";

type SessionSourceSelection = "login" | CurrentSessionSourceId;
export type SessionConnectionAuthMode = Exclude<AuthMode, "api_key" | "openclaw_openai_session">;

type SessionMethodDescriptor = {
  authMode: SessionConnectionAuthMode;
  source: SessionSourceSelection;
  promptValue?: string;
  titleKey: string;
  descriptionKey?: string;
  submitKey: string;
  cliFlag?: string;
  promptLabel?: string;
  requiresAuthJsonPath?: boolean;
  requiresPreparation?: boolean;
  visibleInAddConnection?: boolean;
  visibleInPrompt?: boolean;
};

export type SessionConnectionMethod = SessionMethodDescriptor & {
  key: string;
};

const SESSION_AUTH_MODES = new Set<SessionConnectionAuthMode>([
  "openai_session",
  "claude_session",
  "gemini_cli_session",
  "cursor_session",
]);

const SESSION_METHODS: readonly SessionMethodDescriptor[] = [
  {
    authMode: "openai_session",
    source: "current_codex",
    promptValue: "codex_current",
    titleKey: "addConnection.importAuthJson",
    descriptionKey: "addConnection.importAuthJsonDescription",
    submitKey: "addConnection.importAuthJson",
    cliFlag: "from-codex-current",
    promptLabel: "Import current Codex auth",
    requiresAuthJsonPath: true,
    visibleInAddConnection: true,
    visibleInPrompt: true,
  },
  {
    authMode: "openai_session",
    source: "login",
    promptValue: "login",
    titleKey: "addConnection.signInWithOpenAi",
    descriptionKey: "addConnection.signInWithOpenAiDescription",
    submitKey: "addConnection.signInWithOpenAi",
    cliFlag: "login",
    promptLabel: "Sign in with OpenAI",
    requiresPreparation: true,
    visibleInAddConnection: true,
    visibleInPrompt: true,
  },
  {
    authMode: "claude_session",
    source: "login",
    promptValue: "login",
    titleKey: "addConnection.signInWithClaude",
    descriptionKey: "addConnection.signInWithClaudeDescription",
    submitKey: "addConnection.signInWithClaude",
    cliFlag: "login",
    promptLabel: "Sign in with Claude",
    requiresPreparation: true,
    visibleInAddConnection: true,
    visibleInPrompt: true,
  },
  {
    authMode: "claude_session",
    source: "current_claude",
    promptValue: "claude_current",
    titleKey: "addConnection.signInWithClaude",
    submitKey: "addConnection.signInWithClaude",
    cliFlag: "from-claude-current",
    promptLabel: "Import current Claude session",
    visibleInAddConnection: false,
    visibleInPrompt: false,
  },
  {
    authMode: "gemini_cli_session",
    source: "login",
    promptValue: "login",
    titleKey: "addConnection.signInWithGemini",
    descriptionKey: "addConnection.signInWithGeminiDescription",
    submitKey: "addConnection.signInWithGemini",
    cliFlag: "login",
    promptLabel: "Sign in with Gemini",
    requiresPreparation: true,
    visibleInAddConnection: true,
    visibleInPrompt: true,
  },
  {
    authMode: "gemini_cli_session",
    source: "current_gemini",
    promptValue: "gemini_current",
    titleKey: "addConnection.importCurrentGeminiSession",
    descriptionKey: "addConnection.importCurrentGeminiSessionDescription",
    submitKey: "addConnection.importCurrentGeminiSession",
    cliFlag: "from-gemini-current",
    promptLabel: "Import current Gemini CLI session",
    visibleInAddConnection: false,
    visibleInPrompt: false,
  },
  {
    authMode: "cursor_session",
    source: "current_cursor",
    promptValue: "cursor_current",
    titleKey: "addConnection.useCurrentCursorSession",
    submitKey: "addConnection.useCurrentCursorSession",
    cliFlag: "from-cursor-current",
    promptLabel: "Import current Cursor session",
    visibleInAddConnection: true,
    visibleInPrompt: true,
  },
] as const;

export class SessionConnectionMethodCatalog {
  listForAuthMode(
    authMode: SessionConnectionAuthMode,
  ): SessionConnectionMethod[] {
    return SESSION_METHODS
      .filter((method) => method.authMode === authMode)
      .map((method) => this.withKey(method));
  }

  listVisibleForAddConnection(
    authMode: SessionConnectionAuthMode,
  ): SessionConnectionMethod[] {
    return this.listForAuthMode(authMode).filter((method) => method.visibleInAddConnection !== false);
  }

  listVisibleForPrompt(
    authMode: SessionConnectionAuthMode,
  ): SessionConnectionMethod[] {
    return this.listForAuthMode(authMode).filter((method) => method.visibleInPrompt !== false);
  }

  readDefault(
    authMode: SessionConnectionAuthMode,
  ): SessionConnectionMethod {
    const visible = this.listVisibleForAddConnection(authMode);
    if (visible.length > 0) {
      return visible[0];
    }

    const methods = this.listForAuthMode(authMode);
    if (methods.length === 0) {
      throw new Error(`Unsupported session auth mode: ${authMode}`);
    }
    return methods[0];
  }

  readMethodKey(
    authMode: SessionConnectionAuthMode,
    source: SessionSourceSelection,
  ): string {
    return this.find(authMode, source).key;
  }

  requiresPreparation(
    authMode: SessionConnectionAuthMode,
    source: SessionSourceSelection,
  ): boolean {
    return this.find(authMode, source).requiresPreparation === true;
  }

  requiresAuthJsonPath(
    authMode: SessionConnectionAuthMode,
    source: SessionSourceSelection,
  ): boolean {
    return this.find(authMode, source).requiresAuthJsonPath === true;
  }

  readSubmitKey(
    authMode: SessionConnectionAuthMode,
    source: SessionSourceSelection,
  ): string {
    return this.find(authMode, source).submitKey;
  }

  findByCliFlag(
    authMode: SessionConnectionAuthMode,
    flag: string,
  ): SessionConnectionMethod | null {
    return this.listForAuthMode(authMode).find((method) => method.cliFlag === flag) ?? null;
  }

  readSupportedCliFlags(
    authMode: SessionConnectionAuthMode,
  ): string[] {
    return this.listForAuthMode(authMode).flatMap((method) => method.cliFlag ? [method.cliFlag] : []);
  }

  isSessionAuthMode(authMode: AuthMode | string): authMode is SessionConnectionAuthMode {
    return SESSION_AUTH_MODES.has(authMode as SessionConnectionAuthMode);
  }

  readMethod(
    authMode: AuthMode | string,
    source: SessionSourceSelection,
  ): SessionConnectionMethod | null {
    if (!this.isSessionAuthMode(authMode)) {
      return null;
    }
    return this.listForAuthMode(authMode).find((method) => method.source === source) ?? null;
  }

  readMethodKeyForSelection(
    authMode: AuthMode | string,
    source: SessionSourceSelection,
  ): string | null {
    return this.readMethod(authMode, source)?.key ?? null;
  }

  listVisibleForAddConnectionForAuthMode(authMode: AuthMode | string): SessionConnectionMethod[] {
    return this.isSessionAuthMode(authMode) ? this.listVisibleForAddConnection(authMode) : [];
  }

  listVisibleForPromptForAuthMode(authMode: AuthMode | string): SessionConnectionMethod[] {
    return this.isSessionAuthMode(authMode) ? this.listVisibleForPrompt(authMode) : [];
  }

  readDefaultForAuthMode(authMode: AuthMode | string): SessionConnectionMethod | null {
    return this.isSessionAuthMode(authMode) ? this.readDefault(authMode) : null;
  }

  findByPromptValue(
    authMode: SessionConnectionAuthMode,
    value: string,
  ): SessionConnectionMethod | null {
    return this.listForAuthMode(authMode).find((method) => this.readPromptValue(method) === value) ?? null;
  }

  private find(
    authMode: SessionConnectionAuthMode,
    source: SessionSourceSelection,
  ): SessionConnectionMethod {
    const match = this.listForAuthMode(authMode).find((method) => method.source === source);
    if (!match) {
      throw new Error(`Unsupported session method for auth mode ${authMode} and source ${source}`);
    }
    return match;
  }

  private withKey(method: SessionMethodDescriptor): SessionConnectionMethod {
    return {
      ...method,
      key: `${method.authMode}:${method.source}`,
    };
  }

  readPromptValue(method: SessionConnectionMethod): string {
    return method.promptValue ?? method.source;
  }
}

export const SHARED_SESSION_CONNECTION_METHODS = new SessionConnectionMethodCatalog();
