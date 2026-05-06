import type { AgentId } from "../agent";
import {
  SHARED_CONNECTION_AGENT_POLICY,
} from "./AgentPolicy";
import type { ConnectionPresetFamily } from "./setup/PresetTypes";

export type ConnectionDefinition = {
  preset: ConnectionPresetFamily;
  label: string;
  supportedAuthModes: import("../access").AuthMode[];
  requiresEndpointUrl: boolean;
  configurableAgents: AgentId[];
  defaultEnabledAgents: AgentId[];
  supportsEnvKey: boolean;
  suggestEnabledAgents: boolean;
};

type ConnectionDefinitionSeed = Omit<ConnectionDefinition, "configurableAgents" | "defaultEnabledAgents" | "supportsEnvKey">;

const CONNECTION_DEFINITION_SEEDS: ConnectionDefinitionSeed[] = [
  {
    preset: "openai",
    label: "Official OpenAI",
    supportedAuthModes: ["openai_session", "api_key"],
    requiresEndpointUrl: false,
    suggestEnabledAgents: false,
  },
  {
    preset: "gateway",
    label: "Gateway",
    supportedAuthModes: ["api_key"],
    requiresEndpointUrl: true,
    suggestEnabledAgents: true,
  },
  {
    preset: "azure-openai",
    label: "Azure OpenAI",
    supportedAuthModes: ["api_key"],
    requiresEndpointUrl: true,
    suggestEnabledAgents: false,
  },
  {
    preset: "anthropic",
    label: "Official Claude",
    supportedAuthModes: ["api_key", "claude_session"],
    requiresEndpointUrl: false,
    suggestEnabledAgents: false,
  },
];

export class ConnectionCatalog {
  listDefinitions(): ConnectionDefinition[] {
    return CONNECTION_DEFINITION_SEEDS.map((definition) => this.buildDefinition(definition));
  }

  getDefinition(preset: string): ConnectionDefinition | null {
    const definition = CONNECTION_DEFINITION_SEEDS.find((candidate) => candidate.preset === preset) ?? null;
    return definition ? this.buildDefinition(definition) : null;
  }

  private buildDefinition(definition: ConnectionDefinitionSeed): ConnectionDefinition {
    const config = SHARED_CONNECTION_AGENT_POLICY.readDefinitionConfig(definition.preset);
    return {
      ...definition,
      configurableAgents: config.configurableAgents,
      defaultEnabledAgents: config.defaultEnabledAgents,
      supportsEnvKey: definition.supportedAuthModes.includes("api_key")
        && SHARED_CONNECTION_AGENT_POLICY.supportsEnvKeySource({
          preset: definition.preset,
          authMode: "api_key",
        }),
    };
  }
}

export const SHARED_CONNECTION_CATALOG = new ConnectionCatalog();
