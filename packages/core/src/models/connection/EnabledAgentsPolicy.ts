import type { AgentId } from "../agent/Definitions";

export class EnabledAgentsPolicy {
  reconcile(
    currentEnabledAgents: AgentId[],
    configurableAgents: AgentId[],
    fallbackEnabledAgents: AgentId[],
  ): AgentId[] {
    const configurable = new Set(configurableAgents);
    const retained = this.unique(currentEnabledAgents.filter((agentId) => configurable.has(agentId)));
    if (retained.length > 0) {
      return retained;
    }

    return this.unique(fallbackEnabledAgents.filter((agentId) => configurable.has(agentId)));
  }

  private unique(agentIds: AgentId[]): AgentId[] {
    return [...new Set(agentIds)];
  }
}
