import type { AgentId } from "../models/agent/Types";
import type { AgentAdapter, AgentCapabilitySupport } from "../models/agent";

export class AgentAdapterRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentAdapterRegistryError";
  }
}

export class AgentAdapterRegistry {
  static fromAdapters(adapters: AgentAdapter[]): AgentAdapterRegistry {
    const seen = new Set<AgentId>();
    for (const adapter of adapters) {
      if (seen.has(adapter.agentId)) {
        throw new AgentAdapterRegistryError(`Duplicate agent adapter registered: ${adapter.agentId}`);
      }
      seen.add(adapter.agentId);
    }
    return new AgentAdapterRegistry(
      new Map(adapters.map((a) => [a.agentId, a])),
    );
  }

  constructor(private readonly adapters: Map<AgentId, AgentAdapter>) {}

  get(agentId: AgentId): AgentAdapter {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      throw new AgentAdapterRegistryError(`Agent adapter not implemented: ${agentId}`);
    }
    return adapter;
  }

  listRollbackSupport(): Array<{ agentId: AgentId; rollback: AgentCapabilitySupport }> {
    return Array.from(this.adapters.values()).map((adapter) => ({
      agentId: adapter.agentId,
      rollback: adapter.rollbackSupport,
    }));
  }

  listAgents(): AgentId[] {
    return Array.from(this.adapters.keys());
  }
}
