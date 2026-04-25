export function formatAgentLabel(agentId: string): string {
  if (agentId === "openclaw") {
    return "OpenClaw";
  }
  return agentId.charAt(0).toUpperCase() + agentId.slice(1);
}
