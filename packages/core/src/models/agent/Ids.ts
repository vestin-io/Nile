export type AgentId = "codex" | "cursor" | "claude" | "gemini" | "openclaw" | "opencode";

export const SUPPORTED_AGENT_IDS: readonly AgentId[] = [
  "codex",
  "cursor",
  "claude",
  "gemini",
  "openclaw",
  "opencode",
];

const SUPPORTED_AGENT_ID_SET = new Set<string>(SUPPORTED_AGENT_IDS);

export function isAgentId(value: string): value is AgentId {
  return SUPPORTED_AGENT_ID_SET.has(value);
}
