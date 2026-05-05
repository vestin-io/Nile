export const AGENT_DEFINITIONS = [
  { id: "codex", label: "Codex" },
  { id: "cursor", label: "Cursor" },
  { id: "claude", label: "Claude" },
  { id: "openclaw", label: "OpenClaw" },
] as const;

export type AgentId = (typeof AGENT_DEFINITIONS)[number]["id"];

export const SUPPORTED_AGENT_IDS: AgentId[] = AGENT_DEFINITIONS.map((definition) => definition.id);

export function isAgentId(value: string): value is AgentId {
  return SUPPORTED_AGENT_IDS.includes(value as AgentId);
}

export function formatAgentLabel(agentId: string): string {
  return AGENT_DEFINITIONS.find((definition) => definition.id === agentId)?.label
    ?? (agentId ? agentId.charAt(0).toUpperCase() + agentId.slice(1) : agentId);
}
