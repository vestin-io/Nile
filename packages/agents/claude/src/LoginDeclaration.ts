import type {
  InteractiveSessionLoginInteractionMode,
  InteractiveSessionLoginRequest,
} from "@nile/core/session";

export type InteractiveSessionLoginDeclarationDefinition = {
  authMode: InteractiveSessionLoginRequest["authMode"];
  label: string;
  interactionMode: InteractiveSessionLoginInteractionMode;
};

export const CLAUDE_LOGIN_DECLARATION = {
  authMode: "claude_session",
  label: "Sign in with Claude",
  interactionMode: "terminal_interactive",
} as const satisfies InteractiveSessionLoginDeclarationDefinition;
