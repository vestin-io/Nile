import type {
  InteractiveSessionLoginInteractionMode,
  InteractiveSessionLoginRequest,
} from "@nile/core/session";

export type InteractiveSessionLoginDeclarationDefinition = {
  authMode: InteractiveSessionLoginRequest["authMode"];
  label: string;
  interactionMode: InteractiveSessionLoginInteractionMode;
};

export const CODEX_LOGIN_DECLARATION = {
  authMode: "openai_session",
  label: "Sign in with Codex",
  interactionMode: "browser_oauth",
} as const satisfies InteractiveSessionLoginDeclarationDefinition;
