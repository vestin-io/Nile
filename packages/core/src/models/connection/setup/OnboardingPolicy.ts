import type { AgentId } from "../../agent";
import type { EndpointRegistryInput } from "../../endpoint";
import { SHARED_CONNECTION_CATALOG } from "../Catalog";
import { SHARED_CONNECTION_AGENT_POLICY } from "../AgentPolicy";
import type { ConnectionPresetFamily } from "./PresetTypes";

export type ConnectionOnboardingSuggestion = {
  configurableAgents: AgentId[];
  suggestedAgents: AgentId[];
  defaultEnabledAgents: AgentId[];
};

export class ConnectionOnboardingPolicy {
  suggest(
    preset: ConnectionPresetFamily,
    endpointCandidate: EndpointRegistryInput,
  ): ConnectionOnboardingSuggestion {
    const definition = SHARED_CONNECTION_CATALOG.getDefinition(preset);
    if (!definition) {
      throw new Error(`Unsupported connection preset: ${preset}`);
    }

    const config = SHARED_CONNECTION_AGENT_POLICY.readOnboardingConfig(preset, endpointCandidate);
    const configurableAgents = [...config.configurableAgents];
    const suggestedAgents = definition.suggestEnabledAgents
      ? this.readSupportedAgents(endpointCandidate).filter((agentId) => configurableAgents.includes(agentId))
      : [...config.defaultEnabledAgents];
    const defaultEnabledAgents = suggestedAgents.length > 0
      ? [...suggestedAgents]
      : [...config.defaultEnabledAgents];

    return {
      configurableAgents,
      suggestedAgents,
      defaultEnabledAgents,
    };
  }

  private readSupportedAgents(endpoint: Pick<EndpointRegistryInput, "protocols">): AgentId[] {
    const agents: AgentId[] = [];
    if (endpoint.protocols.openai) {
      agents.push("codex");
    }
    if (endpoint.protocols.anthropic) {
      agents.push("claude");
    }
    if (endpoint.protocols.cursor) {
      agents.push("cursor");
    }
    return [...new Set(agents)];
  }
}
