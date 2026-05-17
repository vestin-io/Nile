import { AGENT_MODULE_REGISTRY } from "../module/Registry";
import { IndexedRegistry } from "../../../services/IndexedRegistry";
import type { AgentId } from "../Ids";
import type { AgentManifestDefinition } from "./Types";

export type AgentManifest = AgentManifestDefinition;

let cachedRevision = -1;
let cachedRegistry = new IndexedRegistry<AgentId, AgentManifest>(
  [],
  (manifest) => manifest.id,
  (agentId) => `Unsupported agent manifest: ${agentId}`,
);

function readManifestRegistry(): IndexedRegistry<AgentId, AgentManifest> {
  const currentRevision = AGENT_MODULE_REGISTRY.readRevision();
  if (cachedRevision === currentRevision) {
    return cachedRegistry;
  }

  cachedRevision = currentRevision;
  cachedRegistry = new IndexedRegistry<AgentId, AgentManifest>(
    AGENT_MODULE_REGISTRY.list().map((module) => module.manifest),
    (manifest) => manifest.id,
    (agentId) => `Unsupported agent manifest: ${agentId}`,
  );
  return cachedRegistry;
}

export function listAgentManifests(): AgentManifest[] {
  return readManifestRegistry().list();
}

export function readAgentManifest(agentId: AgentId): AgentManifest {
  return readManifestRegistry().read(agentId);
}

export function formatAgentLabel(agentId: string): string {
  const manifest = readManifestRegistry().list().find((entry) => entry.id === agentId);
  return manifest?.label ?? (agentId ? agentId.charAt(0).toUpperCase() + agentId.slice(1) : agentId);
}
