import type { AgentAdapter } from "../models/agent/Adapter";
import type { AgentId } from "../models/agent/Ids";
import { AGENT_MODULE_REGISTRY } from "../models/agent/module/Registry";
import { SUPPORTED_AGENT_IDS } from "../models/agent/Ids";
import { IndexedRegistry } from "../services/IndexedRegistry";
import type { AgentFactoryRegistration, RuntimeFactoryInput } from "./Types";

export function listAgentFactoryRegistrations(): AgentFactoryRegistration[] {
  return AGENT_MODULE_REGISTRY.list().map((module) => module.runtimeFactory);
}

export class AgentFactoryRegistry {
  list(): AgentFactoryRegistration[] {
    return this.buildIndex().list();
  }

  createAll(input: RuntimeFactoryInput): AgentAdapter[] {
    return SUPPORTED_AGENT_IDS.map((agentId) => this.read(agentId).create(input));
  }

  read(agentId: AgentId): AgentFactoryRegistration {
    return this.buildIndex().read(agentId);
  }

  private buildIndex() {
    return new IndexedRegistry(
      listAgentFactoryRegistrations(),
      (registration: AgentFactoryRegistration) => registration.agentId,
      (agentId: AgentId) => `Missing agent factory registration: ${agentId}`,
    );
  }
}

export const AGENT_FACTORY_REGISTRY = new AgentFactoryRegistry();
