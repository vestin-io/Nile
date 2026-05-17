export type ConnectionFamilyId =
  | "openai-api-key"
  | "anthropic-api-key"
  | "cursor-api-key"
  | "openai-session"
  | "openclaw-openai-session"
  | "claude-session"
  | "cursor-session"
  | "gemini-cli-session";

export type ConnectionFamilyProtocolKey = "openai" | "anthropic" | "cursor" | "gemini";
