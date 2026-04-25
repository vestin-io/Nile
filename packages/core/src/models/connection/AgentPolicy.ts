import { SUPPORTED_AGENT_IDS, type AgentId } from "../agent";
import type { AuthMode } from "../access";
import type { EndpointFamily, EndpointProtocols, EndpointRegistryInput } from "../endpoint";
import type { ConnectionPresetFamily } from "./PresetTypes";
import type { ConnectionOnboardingSuggestion } from "./OnboardingPolicy";

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
    endpointFamily: EndpointFamily | null;
    protocols: EndpointProtocols;
    authMode: AuthMode;
    openclawModelId?: string | null;
  }): ConnectionAgentConfig {
    if (input.endpointFamily === "gateway") {
      return this.buildConfigurableResult([...SUPPORTED_AGENT_IDS]);
    }

    if (input.endpointFamily === "cursor") {
      return this.buildConfigurableResult(["cursor"]);
    }

    const configurableAgents: AgentId[] = [];
    if (input.protocols.openai) {
      configurableAgents.push("codex");
    }
    if (input.protocols.anthropic) {
      configurableAgents.push("claude");
    }
    if (
      input.authMode === "api_key"
      && input.openclawModelId?.trim()
      && (input.protocols.openai || input.protocols.anthropic)
    ) {
      configurableAgents.push("openclaw");
    }

    return this.buildConfigurableResult(configurableAgents);
  }

  readSelectableAgents(input: {
    preset: ConnectionPresetFamily;
    authMode: AuthMode;
    onboarding?: ConnectionOnboardingSuggestion;
  }): AgentId[] {
    const baseAgents = input.onboarding?.configurableAgents
      ?? this.readDefinitionConfig(input.preset).configurableAgents;
    if (!this.supportsOpenClaw(input)) {
      return [...new Set<AgentId>(baseAgents)];
    }
    return [...new Set<AgentId>([...baseAgents, "openclaw"])];
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
        return ["codex"];
      case "anthropic":
        return ["claude"];
      default:
        return [];
    }
  }

  private readDefaultEnabledAgents(
    preset: ConnectionPresetFamily,
    protocols?: Pick<EndpointProtocols, "openai" | "anthropic" | "cursor">,
  ): AgentId[] {
    if (preset === "gateway" && protocols) {
      const detectedAgents: AgentId[] = [];
      if (protocols.openai) {
        detectedAgents.push("codex");
      }
      if (protocols.anthropic) {
        detectedAgents.push("claude");
      }
      if (protocols.cursor) {
        detectedAgents.push("cursor");
      }
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

  private supportsOpenClaw(input: {
    preset: ConnectionPresetFamily;
    authMode: AuthMode;
    onboarding?: ConnectionOnboardingSuggestion;
  }): boolean {
    if (input.authMode !== "api_key") {
      return false;
    }
    if (input.preset === "gateway") {
      return Boolean(input.onboarding?.suggestedAgents.some((agentId) => agentId === "codex" || agentId === "claude"));
    }
    return input.preset === "openai"
      || input.preset === "azure-openai"
      || input.preset === "anthropic";
  }

  private supportsAgentEnvKey(agentId: AgentId): boolean {
    return agentId === "codex" || agentId === "claude" || agentId === "openclaw";
  }
}

export const SHARED_CONNECTION_AGENT_POLICY = new ConnectionAgentPolicy();
