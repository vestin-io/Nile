import { AGENT_CAPABILITIES, SUPPORTED_AGENT_IDS, type AgentId } from "../agent";
import type { AuthMode } from "../access";
import type { EndpointProtocols, EndpointRegistryInput } from "../endpoint";
import type { ConnectionPresetFamily } from "./setup/PresetTypes";
import type { ConnectionOnboardingSuggestion } from "./setup/OnboardingPolicy";

export type ConnectionAgentConfig = {
  configurableAgents: AgentId[];
  defaultEnabledAgents: AgentId[];
};

export class ConnectionAgentPolicy {
  readDefinitionConfig(preset: ConnectionPresetFamily): ConnectionAgentConfig {
    const configurableAgents = this.readDefinitionConfigurableAgents(preset);
    return {
      configurableAgents: [...new Set(configurableAgents)],
      defaultEnabledAgents: this.readDefinitionDefaultEnabledAgents(preset, configurableAgents),
    };
  }

  readOnboardingConfig(
    preset: ConnectionPresetFamily,
    endpointCandidate: Pick<EndpointRegistryInput, "protocols">,
  ): ConnectionAgentConfig {
    return {
      configurableAgents: this.readDefinitionConfigurableAgents(preset),
      defaultEnabledAgents: this.readDefaultEnabledAgents(preset, endpointCandidate.protocols),
    };
  }

  readSavedConnectionConfig(input: {
    protocols: EndpointProtocols;
    authMode: AuthMode;
  }): ConnectionAgentConfig {
    return this.buildConfigurableResult(
      SUPPORTED_AGENT_IDS.filter((agentId) => AGENT_CAPABILITIES.supportsSavedConnection(agentId, input)),
    );
  }

  readSelectableAgents(input: {
    preset: ConnectionPresetFamily;
    authMode: AuthMode;
    onboarding?: ConnectionOnboardingSuggestion;
  }): AgentId[] {
    const baseAgents = input.onboarding?.configurableAgents
      ?? this.readDefinitionConfig(input.preset).configurableAgents;
    return [...new Set<AgentId>(
      baseAgents.filter((agentId) => AGENT_CAPABILITIES.supportsSelectableConnection(agentId, {
        preset: input.preset,
        authMode: input.authMode,
      })),
    )];
  }

  supportsAgent(input: {
    preset: ConnectionPresetFamily;
    authMode: AuthMode;
    agentId: AgentId;
    onboarding?: ConnectionOnboardingSuggestion;
  }): boolean {
    return this.readSelectableAgents(input).includes(input.agentId);
  }

  supportsEnvKeySource(input: {
    preset: ConnectionPresetFamily;
    authMode: AuthMode;
    onboarding?: ConnectionOnboardingSuggestion;
  }): boolean {
    if (input.authMode !== "api_key") {
      return false;
    }

    return this.readSelectableAgents(input).some((agentId) => this.supportsAgentEnvKey(agentId));
  }

  private readDefinitionConfigurableAgents(preset: ConnectionPresetFamily): AgentId[] {
    switch (preset) {
      case "gateway":
        return [...SUPPORTED_AGENT_IDS];
      case "openai":
      case "azure-openai":
        return ["codex", "openclaw"];
      case "anthropic":
        return ["claude", "openclaw"];
      default:
        return [];
    }
  }

  private readDefaultEnabledAgents(
    preset: ConnectionPresetFamily,
    protocols?: Pick<EndpointProtocols, "openai" | "anthropic" | "cursor">,
  ): AgentId[] {
    if (preset === "gateway" && protocols) {
      const detectedAgents = SUPPORTED_AGENT_IDS.filter((agentId) =>
        AGENT_CAPABILITIES.supportsDetectedProtocols(agentId, protocols));
      if (detectedAgents.length > 0) {
        return [...new Set(detectedAgents)];
      }
      return ["codex", "claude"];
    }

    return this.readDefinitionDefaultEnabledAgents(
      preset,
      this.readDefinitionConfigurableAgents(preset),
    );
  }

  private readDefinitionDefaultEnabledAgents(
    preset: ConnectionPresetFamily,
    configurableAgents: AgentId[],
  ): AgentId[] {
    if (preset === "gateway") {
      return ["codex", "claude"];
    }
    return configurableAgents.length > 0 ? [configurableAgents[0]] : [];
  }

  private buildConfigurableResult(configurableAgents: AgentId[]): ConnectionAgentConfig {
    const uniqueAgents = [...new Set(configurableAgents)];
    return {
      configurableAgents: uniqueAgents,
      defaultEnabledAgents: [...uniqueAgents],
    };
  }

  private supportsAgentEnvKey(agentId: AgentId): boolean {
    return AGENT_CAPABILITIES.read(agentId).supportsManagedEnvBackedApiKey;
  }
}

export const SHARED_CONNECTION_AGENT_POLICY = new ConnectionAgentPolicy();
