import { AGENT_CAPABILITIES, SUPPORTED_AGENT_IDS, type AgentId } from "../agent";
import type { AuthMode } from "../access";
import type { EndpointProtocols, EndpointRegistryInput } from "../endpoint";
import {
  CONNECTION_PRESET_ONBOARDING_SUPPORT,
  CONNECTION_PRESET_REGISTRY,
  type ConnectionPresetFamily,
} from "./preset";
import type { ConnectionOnboardingSuggestion } from "./Runtime";
import { SHARED_CONNECTION_ENV_KEY_SUPPORT } from "./EnvKeySupport";

export type ConnectionAgentConfig = {
  configurableAgents: AgentId[];
  defaultEnabledAgents: AgentId[];
};

export class ConnectionAgentPolicy {
  readDefinitionConfig(preset: ConnectionPresetFamily): ConnectionAgentConfig {
    const configurableAgents = CONNECTION_PRESET_REGISTRY.readRequired(preset).configurableAgents;
    return {
      configurableAgents: [...new Set(configurableAgents)],
      defaultEnabledAgents: this.readDefinitionDefaultEnabledAgents(preset),
    };
  }

  readOnboardingConfig(
    preset: ConnectionPresetFamily,
    endpointCandidate: Pick<EndpointRegistryInput, "protocols">,
  ): ConnectionAgentConfig {
    return CONNECTION_PRESET_ONBOARDING_SUPPORT.readConfig(preset, endpointCandidate.protocols);
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
      baseAgents.filter((agentId: AgentId) => AGENT_CAPABILITIES.supportsSelectableConnection(agentId, {
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

    return SHARED_CONNECTION_ENV_KEY_SUPPORT.supportsAny(this.readSelectableAgents(input));
  }

  private readDefinitionDefaultEnabledAgents(preset: ConnectionPresetFamily): AgentId[] {
    return [...CONNECTION_PRESET_REGISTRY.readRequired(preset).defaultEnabledAgents];
  }

  private buildConfigurableResult(configurableAgents: AgentId[]): ConnectionAgentConfig {
    const uniqueAgents = [...new Set(configurableAgents)];
    return {
      configurableAgents: uniqueAgents,
      defaultEnabledAgents: [...uniqueAgents],
    };
  }

}

export const SHARED_CONNECTION_AGENT_POLICY = new ConnectionAgentPolicy();
