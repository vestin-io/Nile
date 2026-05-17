import { CLAUDE_LOGIN_DECLARATION } from "@nile/agent-claude/login-declaration";
import { CODEX_LOGIN_DECLARATION } from "@nile/agent-codex/login-declaration";
import { GEMINI_LOGIN_DECLARATION } from "@nile/agent-gemini/login-declaration";
import type { InteractiveSessionLoginRequest } from "@nile/core/session";

export type InteractiveSessionLoginDeclaration = typeof BUILTIN_INTERACTIVE_SESSION_LOGIN_DECLARATIONS[number];

export const BUILTIN_INTERACTIVE_SESSION_LOGIN_DECLARATIONS = [
  CODEX_LOGIN_DECLARATION,
  CLAUDE_LOGIN_DECLARATION,
  GEMINI_LOGIN_DECLARATION,
] as const;

export function isBuiltinInteractiveSessionLoginAuthMode(
  authMode: string,
): authMode is InteractiveSessionLoginDeclaration["authMode"] {
  return BUILTIN_INTERACTIVE_SESSION_LOGIN_DECLARATIONS.some((declaration) => declaration.authMode === authMode);
}

export function readBuiltinInteractiveSessionLoginDeclaration(
  authMode: InteractiveSessionLoginRequest["authMode"],
): InteractiveSessionLoginDeclaration {
  const match = BUILTIN_INTERACTIVE_SESSION_LOGIN_DECLARATIONS.find((declaration) => declaration.authMode === authMode);
  if (!match) {
    throw new Error(`Unsupported interactive session login auth mode: ${authMode}`);
  }
  return match;
}
