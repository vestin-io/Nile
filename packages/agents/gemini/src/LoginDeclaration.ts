import type {
  InteractiveSessionLoginInteractionMode,
  InteractiveSessionLoginRequest,
} from "@nile/core/session";

export type InteractiveSessionLoginDeclarationDefinition = {
  authMode: InteractiveSessionLoginRequest["authMode"];
  label: string;
  interactionMode: InteractiveSessionLoginInteractionMode;
};

export const GEMINI_LOGIN_DECLARATION = {
  authMode: "gemini_cli_session",
  label: "Sign in with Gemini",
  interactionMode: "terminal_interactive",
} as const satisfies InteractiveSessionLoginDeclarationDefinition;
