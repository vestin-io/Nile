import { SHARED_CONNECTION_AGENT_POLICY } from "@nile/core/models/connection";
import type { ConnectionDefinition, ConnectionOnboardingSuggestion } from "@nile/core/models/connection";
import type { AgentId } from "@nile/core/models/agent";
import type { AuthMode } from "@nile/core/models/access";

import { formatAgentLabel } from "../formatters";
import { InteractivePrompt } from "../InteractivePrompt";

type AgentSelectionInput = {
  authMode: AuthMode;
  definition: ConnectionDefinition;
  onboarding?: ConnectionOnboardingSuggestion;
  openclawModelId?: string;
  requestedAgents?: AgentId[];
};

export class ConnectionAgentSelectionFlow {
  constructor(private readonly prompt: InteractivePrompt) {}

  finalize(input: AgentSelectionInput): { enabledAgents?: AgentId[]; openclawModelId?: string } {
    if (input.requestedAgents) {
      return this.finalizeSelection({
        authMode: input.authMode,
        definition: input.definition,
        enabledAgents: input.requestedAgents,
        hasExplicitAgents: true,
        onboarding: input.onboarding,
        openclawModelId: input.openclawModelId,
      });
    }

    const defaultEnabledAgents = input.definition.configurableAgents.length <= 1
      ? input.definition.defaultEnabledAgents
      : input.onboarding?.defaultEnabledAgents;
    return this.finalizeSelection({
      authMode: input.authMode,
      definition: input.definition,
      enabledAgents: defaultEnabledAgents,
      hasExplicitAgents: false,
      onboarding: input.onboarding,
      openclawModelId: input.openclawModelId,
    });
  }

  async promptForSelection(
    definition: ConnectionDefinition,
    authMode: AuthMode,
    onboarding: ConnectionOnboardingSuggestion,
  ): Promise<{ enabledAgents?: AgentId[]; openclawModelId?: string }> {
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
        onboarding.suggestedAgents.length > 0
          ? `Detected support: ${onboarding.suggestedAgents.map((agentId) => formatAgentLabel(agentId)).join(", ")}. Choose which agents to enable`
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
          initialValues: onboarding.defaultEnabledAgents,
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

      const openclawModelId = await this.promptForOpenClawModelId();
      if (openclawModelId === null) {
        continue;
      }
      return { enabledAgents, openclawModelId };
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
    openclawModelId?: string;
  }): { enabledAgents?: AgentId[]; openclawModelId?: string } {
    const includesOpenClaw = input.enabledAgents?.includes("openclaw") ?? false;
    if (!includesOpenClaw && !input.openclawModelId) {
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
    if (includesOpenClaw && !input.openclawModelId) {
      throw new Error("add --agents openclaw requires --openclaw-model-id");
    }
    if (input.openclawModelId && input.hasExplicitAgents && !includesOpenClaw) {
      throw new Error("add --openclaw-model-id requires --agents to include openclaw");
    }
    if (input.openclawModelId && !input.enabledAgents) {
      return { enabledAgents: ["openclaw"], openclawModelId: input.openclawModelId };
    }
    return {
      enabledAgents: this.uniqueAgents([...(input.enabledAgents ?? []), "openclaw"]),
      openclawModelId: input.openclawModelId,
    };
  }

  private async promptForOpenClawModelId(): Promise<string | null> {
    while (true) {
      const input = await this.prompt.input("OpenClaw model id", { allowBack: true, allowCancel: true });
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
}
