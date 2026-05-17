import type { AgentId } from "../models/agent/Definitions";
import { AGENT_MODULE_REGISTRY } from "../models/agent/module/Registry";
import { IndexedRegistry } from "../services/IndexedRegistry";
import type { AgentProjectionRegistration } from "./Types";

function readProjectionRegistrations(): AgentProjectionRegistration[] {
  return AGENT_MODULE_REGISTRY.list().map((module) => module.projection);
}

export function listAgentProjectionRegistrations(): AgentProjectionRegistration[] {
  return readProjectionRegistrations();
}

export class AgentProjectionRegistry {
  list(): AgentProjectionRegistration[] {
    return this.buildIndex().list();
  }

  read(agentId: AgentId): AgentProjectionRegistration {
    return this.buildIndex().read(agentId);
  }

  private buildIndex() {
    return new IndexedRegistry(
      readProjectionRegistrations(),
      (registration: AgentProjectionRegistration) => registration.agentId,
      (agentId: AgentId) => `No projection strategy is registered for ${String(agentId)}`,
    );
  }
}

export const AGENT_PROJECTION_REGISTRY = new AgentProjectionRegistry();
