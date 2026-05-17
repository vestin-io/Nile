import { existsSync } from "node:fs";
import { join } from "node:path";

import type { AgentId } from "./Ids";
import { AGENT_MODULE_REGISTRY } from "./module/Registry";
import { SUPPORTED_AGENT_IDS } from "./Ids";

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
  const declaration = AGENT_MODULE_REGISTRY.list().find((module) => module.manifest.id === agentId)?.manifest;
  if (!declaration) {
    throw new Error(`Unsupported agent home: ${agentId}`);
  }
  const candidates = declaration.homeCandidates;
  for (const candidate of candidates) {
    if (candidate.markers.some((marker: string) => pathExists(join(candidate.path, marker)))) {
      return candidate.path;
    }
  }

  return candidates[0].path;
}
