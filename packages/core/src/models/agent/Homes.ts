import { homedir } from "node:os";
import { join } from "node:path";

import type { AgentId } from "./Types";
import { SUPPORTED_AGENT_IDS } from "./Types";

const DEFAULT_HOMES: Record<AgentId, string> = {
  codex: join(homedir(), ".codex"),
  cursor: join(homedir(), ".cursor"),
  claude: join(homedir(), ".claude"),
  openclaw: join(homedir(), ".openclaw"),
};

/** Optional per-agent install roots; omitted keys use OS defaults. */
export type AgentHomes = Partial<Record<AgentId, string>>;

export function resolveAgentHome(agentId: AgentId, homes?: AgentHomes): string {
  const override = homes?.[agentId]?.trim();
  if (override) {
    return override;
  }
  return DEFAULT_HOMES[agentId];
}

export function mergeAgentHomes(base: AgentHomes | undefined, patch: AgentHomes | undefined): AgentHomes {
  return { ...base, ...patch };
}

export function defaultAgentHomes(): AgentHomes {
  return Object.fromEntries(SUPPORTED_AGENT_IDS.map((id) => [id, DEFAULT_HOMES[id]])) as AgentHomes;
}
