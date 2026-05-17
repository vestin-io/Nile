export const SUPPORTED_AUTH_MODES = [
  "api_key",
  "claude_session",
  "openai_session",
  "openclaw_openai_session",
  "cursor_session",
  "gemini_cli_session",
] as const;

export type AuthMode = (typeof SUPPORTED_AUTH_MODES)[number];
