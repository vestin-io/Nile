export const SUPPORTED_AGENT_IDS = [
  "codex",
  "cursor",
  "claude",
  "openclaw",
] as const;

export type AgentId = (typeof SUPPORTED_AGENT_IDS)[number];

export function isAgentId(value: string): value is AgentId {
  return SUPPORTED_AGENT_IDS.includes(value as AgentId);
}
