import { AGENT_CAPABILITIES, SUPPORTED_AGENT_IDS, type AgentId } from "../../agent";
import type { EndpointRegistryInput } from "../../endpoint";
import { SHARED_CONNECTION_CATALOG } from "../Catalog";
import { SHARED_CONNECTION_AGENT_POLICY } from "../AgentPolicy";
import type { ConnectionPresetFamily } from "./PresetTypes";

export type ConnectionOnboardingSuggestion = {
  configurableAgents: AgentId[];
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
    const detectedAgents = definition.suggestEnabledAgents
      ? this.readSupportedAgents(endpointCandidate).filter((agentId) => config.configurableAgents.includes(agentId))
      : [];
    const configurableAgents = detectedAgents.length > 0
      ? [...detectedAgents]
      : [...config.configurableAgents];
    const defaultEnabledAgents = detectedAgents.length > 0
      ? [...detectedAgents]
      : [...config.defaultEnabledAgents];

    return {
      configurableAgents,
      defaultEnabledAgents,
    };
  }

  private readSupportedAgents(endpoint: Pick<EndpointRegistryInput, "protocols">): AgentId[] {
    return SUPPORTED_AGENT_IDS.filter((agentId) =>
      AGENT_CAPABILITIES.supportsDetectedProtocols(agentId, endpoint.protocols));
  }
}
