import type { AgentId } from "../agent";
import type { AuthMode } from "../access";
import type { EndpointRegistryInput } from "../endpoint";
import type { ConnectionOnboardingSuggestion } from "./Runtime";
import {
  CONNECTION_PRESET_ONBOARDING_SUPPORT,
  CONNECTION_PRESET_REGISTRY,
  type ConnectionPresetFamily,
  type ConnectionPresetManifest,
} from "./preset";
import { SHARED_CONNECTION_AGENT_POLICY } from "./AgentPolicy";
import { SHARED_CONNECTION_ENV_KEY_SUPPORT } from "./EnvKeySupport";

export type ConnectionDefinition = {
  preset: ConnectionPresetFamily;
  label: string;
  iconKey: string;
  supportedAuthModes: AuthMode[];
  requiresEndpointUrl: boolean;
  configurableAgents: AgentId[];
  selectableAgents: AgentId[];
  defaultEnabledAgents: AgentId[];
  suggestEnabledAgents: boolean;
  supportsEnvKey: boolean;
};

export class ConnectionPresetSupport {
  listDefinitions(): ConnectionDefinition[] {
    return CONNECTION_PRESET_REGISTRY.list().map((definition) => this.buildDefinition(definition));
  }

  readDefinition(preset: string): ConnectionDefinition | null {
    const definition = CONNECTION_PRESET_REGISTRY.read(preset);
    return definition ? this.buildDefinition(definition) : null;
  }

  suggestOnboarding(
    preset: ConnectionPresetFamily,
    endpointCandidate: EndpointRegistryInput,
  ): ConnectionOnboardingSuggestion {
    return CONNECTION_PRESET_ONBOARDING_SUPPORT.readConfig(preset, endpointCandidate.protocols);
  }

  private buildDefinition(definition: ConnectionPresetManifest<ConnectionPresetFamily>): ConnectionDefinition {
    const selectableAgents = [...new Set(
      definition.supportedAuthModes.flatMap((authMode) => SHARED_CONNECTION_AGENT_POLICY.readSelectableAgents({
        preset: definition.id,
        authMode,
      })),
    )];

    return {
      preset: definition.id,
      label: definition.label,
      iconKey: definition.iconKey,
      supportedAuthModes: definition.supportedAuthModes,
      requiresEndpointUrl: definition.requiresEndpointUrl,
      configurableAgents: [...definition.configurableAgents],
      selectableAgents,
      defaultEnabledAgents: [...definition.defaultEnabledAgents],
      suggestEnabledAgents: definition.suggestEnabledAgents,
      supportsEnvKey: definition.supportedAuthModes.includes("api_key")
        && SHARED_CONNECTION_ENV_KEY_SUPPORT.supportsAny(definition.configurableAgents),
    };
  }
}

export const SHARED_CONNECTION_PRESET_SUPPORT = new ConnectionPresetSupport();
