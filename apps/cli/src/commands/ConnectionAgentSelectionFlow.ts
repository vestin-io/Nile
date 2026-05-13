import { SHARED_CONNECTION_AGENT_POLICY } from "@nile/core/models/connection";
import type { ConnectionDefinition, ConnectionOnboardingSuggestion } from "@nile/core/models/connection";
import { AGENT_CAPABILITIES, type AgentId } from "@nile/core/models/agent";
import type { AuthMode } from "@nile/core/models/access";

import { formatAgentLabel } from "@nile/core/models/agent/types";
import { InteractivePrompt } from "../InteractivePrompt";

type AgentSelectionInput = {
  authMode: AuthMode;
  definition: ConnectionDefinition;
  onboarding?: ConnectionOnboardingSuggestion;
  selectedModelId?: string;
  requestedAgents?: AgentId[];
};

export class ConnectionAgentSelectionFlow {
  constructor(private readonly prompt: InteractivePrompt) {}

  finalize(input: AgentSelectionInput): { enabledAgents?: AgentId[]; selectedModelId?: string } {
    if (input.requestedAgents) {
      return this.finalizeSelection({
        authMode: input.authMode,
        definition: input.definition,
        enabledAgents: input.requestedAgents,
        hasExplicitAgents: true,
        onboarding: input.onboarding,
        selectedModelId: input.selectedModelId,
      });
    }

    const defaultEnabledAgents = input.definition.configurableAgents.length <= 1
      ? input.definition.defaultEnabledAgents
      : input.onboarding?.defaultEnabledAgents;
    return this.finalizeSelection({
      authMode: input.authMode,
      definition: input.definition,
      enabledAgents: this.filterImplicitSelectedModelAgents(defaultEnabledAgents, input.selectedModelId),
      hasExplicitAgents: false,
      onboarding: input.onboarding,
      selectedModelId: input.selectedModelId,
    });
  }

  async promptForSelection(
    definition: ConnectionDefinition,
    authMode: AuthMode,
    onboarding: ConnectionOnboardingSuggestion,
  ): Promise<{ enabledAgents?: AgentId[]; selectedModelId?: string }> {
    const configurableAgents = SHARED_CONNECTION_AGENT_POLICY.readSelectableAgents({
      authMode,
      onboarding,
      preset: definition.preset,
    });

    if (configurableAgents.length <= 1) {
      return {};
    }

    while (true) {
      const selection = await this.prompt.multiSelect(
        onboarding.defaultEnabledAgents.length > 0
          ? `Detected support: ${onboarding.defaultEnabledAgents.map((agentId) => formatAgentLabel(agentId)).join(", ")}. Choose which agents to enable`
          : "No compatible agents were detected yet. Choose which agents to enable",
        configurableAgents.map((agentId) => ({
          value: agentId,
          label: formatAgentLabel(agentId),
        })),
        {
          allowBack: true,
          allowCancel: true,
          allowDone: true,
          doneLabel: "Enable selected",
          initialValues: this.filterImplicitSelectedModelAgents(onboarding.defaultEnabledAgents),
        },
      );
      if (selection.type === "cancel") {
        throw new Error("Cancelled");
      }
      if (selection.type === "back") {
        throw new Error("Back");
      }
      if (selection.values.length === 0) {
        throw new Error("At least one agent must be enabled");
      }

      const enabledAgents = this.uniqueAgents(selection.values as AgentId[]);
      if (!enabledAgents.includes("openclaw")) {
        return { enabledAgents };
      }

      const selectedModelId = await this.promptForOpenClawModelId();
      if (selectedModelId === null) {
        continue;
      }
      return { enabledAgents, selectedModelId };
    }
  }

  parseRequestedAgents(value: string): AgentId[] {
    const agents = value
      .split(",")
      .map((item) => item.trim())
      .filter((item): item is AgentId =>
        item === "codex" || item === "claude" || item === "cursor" || item === "openclaw");
    if (agents.length === 0) {
      throw new Error("add --agents requires a comma-separated list like codex,claude,openclaw");
    }
    return this.uniqueAgents(agents);
  }

  private finalizeSelection(input: {
    authMode: AuthMode;
    definition: ConnectionDefinition;
    enabledAgents?: AgentId[];
    hasExplicitAgents: boolean;
    onboarding?: ConnectionOnboardingSuggestion;
    selectedModelId?: string;
  }): { enabledAgents?: AgentId[]; selectedModelId?: string } {
    const includesOpenClaw = input.enabledAgents?.includes("openclaw") ?? false;
    if (!includesOpenClaw && !input.selectedModelId) {
      return input.enabledAgents ? { enabledAgents: input.enabledAgents } : {};
    }
    if (!SHARED_CONNECTION_AGENT_POLICY.supportsAgent({
      agentId: "openclaw",
      authMode: input.authMode,
      onboarding: input.onboarding,
      preset: input.definition.preset,
    })) {
      throw new Error("OpenClaw is only available for supported OpenAI- or Anthropic-compatible connections");
    }
    if (includesOpenClaw && !input.selectedModelId) {
      throw new Error("add --agents openclaw requires --model-id");
    }
    if (input.selectedModelId && input.hasExplicitAgents && !includesOpenClaw) {
      throw new Error("add --model-id requires --agents to include openclaw");
    }
    if (input.selectedModelId && !input.enabledAgents) {
      return { enabledAgents: ["openclaw"], selectedModelId: input.selectedModelId };
    }
    return {
      enabledAgents: this.uniqueAgents([...(input.enabledAgents ?? []), "openclaw"]),
      selectedModelId: input.selectedModelId,
    };
  }

  private async promptForOpenClawModelId(): Promise<string | null> {
    while (true) {
      const input = await this.prompt.input("Model id", { allowBack: true, allowCancel: true });
      if (input.type === "cancel") {
        throw new Error("Cancelled");
      }
      if (input.type === "back") {
        return null;
      }
      const modelId = input.value.trim();
      if (modelId) {
        return modelId;
      }
    }
  }

  private uniqueAgents(agentIds: AgentId[]): AgentId[] {
    return [...new Set(agentIds)];
  }

  private filterImplicitSelectedModelAgents(
    enabledAgents?: AgentId[],
    selectedModelId?: string,
  ): AgentId[] | undefined {
    if (!enabledAgents || enabledAgents.length === 0 || selectedModelId?.trim()) {
      return enabledAgents;
    }

    return enabledAgents.filter((agentId) =>
      !AGENT_CAPABILITIES.read(agentId).requiredApplyRequirements.includes("selected-model"));
  }
}
