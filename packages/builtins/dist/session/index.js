// src/session/index.ts
import { INTERACTIVE_SESSION_LOGIN_REGISTRY } from "@nile/core/session";

// src/session/LoginDeclarations.ts
import { CLAUDE_LOGIN_DECLARATION } from "@nile/agent-claude/login-declaration";
import { CODEX_LOGIN_DECLARATION } from "@nile/agent-codex/login-declaration";
import { GEMINI_LOGIN_DECLARATION } from "@nile/agent-gemini/login-declaration";
var BUILTIN_INTERACTIVE_SESSION_LOGIN_DECLARATIONS = [
  CODEX_LOGIN_DECLARATION,
  CLAUDE_LOGIN_DECLARATION,
  GEMINI_LOGIN_DECLARATION
];
function isBuiltinInteractiveSessionLoginAuthMode(authMode) {
  return BUILTIN_INTERACTIVE_SESSION_LOGIN_DECLARATIONS.some((declaration) => declaration.authMode === authMode);
}
function readBuiltinInteractiveSessionLoginDeclaration(authMode) {
  const match = BUILTIN_INTERACTIVE_SESSION_LOGIN_DECLARATIONS.find((declaration) => declaration.authMode === authMode);
  if (!match) {
    throw new Error(`Unsupported interactive session login auth mode: ${authMode}`);
  }
  return match;
}

// src/session/MethodCatalog.ts
var SESSION_AUTH_MODES = /* @__PURE__ */ new Set([
  "openai_session",
  "claude_session",
  "gemini_cli_session",
  "cursor_session"
]);
var SESSION_METHODS = [
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
    visibleInPrompt: true
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
    visibleInPrompt: true
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
    visibleInPrompt: true
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
    visibleInPrompt: false
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
    visibleInPrompt: true
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
    visibleInPrompt: false
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
    visibleInPrompt: true
  }
];
var SessionConnectionMethodCatalog = class {
  listForAuthMode(authMode) {
    return SESSION_METHODS.filter((method) => method.authMode === authMode).map((method) => this.withKey(method));
  }
  listVisibleForAddConnection(authMode) {
    return this.listForAuthMode(authMode).filter((method) => method.visibleInAddConnection !== false);
  }
  listVisibleForPrompt(authMode) {
    return this.listForAuthMode(authMode).filter((method) => method.visibleInPrompt !== false);
  }
  readDefault(authMode) {
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
  readMethodKey(authMode, source) {
    return this.find(authMode, source).key;
  }
  requiresPreparation(authMode, source) {
    return this.find(authMode, source).requiresPreparation === true;
  }
  requiresAuthJsonPath(authMode, source) {
    return this.find(authMode, source).requiresAuthJsonPath === true;
  }
  readSubmitKey(authMode, source) {
    return this.find(authMode, source).submitKey;
  }
  findByCliFlag(authMode, flag) {
    return this.listForAuthMode(authMode).find((method) => method.cliFlag === flag) ?? null;
  }
  readSupportedCliFlags(authMode) {
    return this.listForAuthMode(authMode).flatMap((method) => method.cliFlag ? [method.cliFlag] : []);
  }
  isSessionAuthMode(authMode) {
    return SESSION_AUTH_MODES.has(authMode);
  }
  readMethod(authMode, source) {
    if (!this.isSessionAuthMode(authMode)) {
      return null;
    }
    return this.listForAuthMode(authMode).find((method) => method.source === source) ?? null;
  }
  readMethodKeyForSelection(authMode, source) {
    return this.readMethod(authMode, source)?.key ?? null;
  }
  listVisibleForAddConnectionForAuthMode(authMode) {
    return this.isSessionAuthMode(authMode) ? this.listVisibleForAddConnection(authMode) : [];
  }
  listVisibleForPromptForAuthMode(authMode) {
    return this.isSessionAuthMode(authMode) ? this.listVisibleForPrompt(authMode) : [];
  }
  readDefaultForAuthMode(authMode) {
    return this.isSessionAuthMode(authMode) ? this.readDefault(authMode) : null;
  }
  findByPromptValue(authMode, value) {
    return this.listForAuthMode(authMode).find((method) => this.readPromptValue(method) === value) ?? null;
  }
  find(authMode, source) {
    const match = this.listForAuthMode(authMode).find((method) => method.source === source);
    if (!match) {
      throw new Error(`Unsupported session method for auth mode ${authMode} and source ${source}`);
    }
    return match;
  }
  withKey(method) {
    let interactionMode = method.interactionMode;
    if (method.source === "login") {
      if (!isBuiltinInteractiveSessionLoginAuthMode(method.authMode)) {
        throw new Error(`Unsupported interactive session login auth mode: ${method.authMode}`);
      }
      interactionMode = readBuiltinInteractiveSessionLoginDeclaration(method.authMode).interactionMode;
    }
    return {
      ...method,
      ...interactionMode ? { interactionMode } : {},
      key: `${method.authMode}:${method.source}`
    };
  }
  readPromptValue(method) {
    return method.promptValue ?? method.source;
  }
};
var SHARED_SESSION_CONNECTION_METHODS = new SessionConnectionMethodCatalog();
export {
  BUILTIN_INTERACTIVE_SESSION_LOGIN_DECLARATIONS,
  INTERACTIVE_SESSION_LOGIN_REGISTRY,
  SHARED_SESSION_CONNECTION_METHODS,
  SessionConnectionMethodCatalog,
  isBuiltinInteractiveSessionLoginAuthMode,
  readBuiltinInteractiveSessionLoginDeclaration
};
