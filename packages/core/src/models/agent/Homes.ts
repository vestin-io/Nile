import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { AgentId } from "./Types";
import { SUPPORTED_AGENT_IDS } from "./Types";

const homePath = homedir();

const DEFAULT_HOME_CANDIDATES: Record<AgentId, Array<{
  path: string;
  markers: string[];
}>> = {
  codex: [
    {
      path: join(homePath, ".codex"),
      markers: ["auth.json", "config.toml"],
    },
    {
      path: join(homePath, "Library", "Application Support", "Codex"),
      markers: ["auth.json", "config.toml"],
    },
  ],
  cursor: [
    {
      path: join(homePath, ".cursor"),
      markers: ["cli-config.json"],
    },
    {
      path: join(homePath, "Library", "Application Support", "Cursor"),
      markers: ["cli-config.json"],
    },
  ],
  claude: [
    {
      path: join(homePath, ".claude"),
      markers: ["settings.json", ".credentials.json"],
    },
    {
      path: join(homePath, "Library", "Application Support", "Claude"),
      markers: ["settings.json", ".credentials.json"],
    },
  ],
  openclaw: [
    {
      path: join(homePath, ".openclaw"),
      markers: ["openclaw.json"],
    },
    {
      path: join(homePath, "Library", "Application Support", "OpenClaw"),
      markers: ["openclaw.json"],
    },
  ],
};

/** Optional per-agent install roots; omitted keys use OS defaults. */
export type AgentHomes = Partial<Record<AgentId, string>>;

export function resolveAgentHome(agentId: AgentId, homes?: AgentHomes): string {
  const override = homes?.[agentId]?.trim();
  if (override) {
    return override;
  }
  return readDefaultAgentHome(agentId);
}

export function mergeAgentHomes(base: AgentHomes | undefined, patch: AgentHomes | undefined): AgentHomes {
  return { ...base, ...patch };
}

export function defaultAgentHomes(): AgentHomes {
  return Object.fromEntries(SUPPORTED_AGENT_IDS.map((id) => [id, readDefaultAgentHome(id)])) as AgentHomes;
}

export function readDefaultAgentHome(
  agentId: AgentId,
  pathExists: (path: string) => boolean = existsSync,
): string {
  const candidates = DEFAULT_HOME_CANDIDATES[agentId];
  for (const candidate of candidates) {
    if (candidate.markers.some((marker) => pathExists(join(candidate.path, marker)))) {
      return candidate.path;
    }
  }

  return candidates[0].path;
}
