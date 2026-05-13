import { SHARED_CONNECTION_CATALOG } from "@nile/core/models/connection";
import type {
  ConnectionDefinition,
  ConnectionOnboardingSuggestion,
  ConnectionPresetFamily,
} from "@nile/core/models/connection";
import type { AgentId } from "@nile/core/models/agent";
import type { AuthMode } from "@nile/core/models/access";
import type { StoredCredential } from "@nile/core/services/credential";

import type { ResolvedCliOptions } from "../types";
import { InteractivePrompt } from "../InteractivePrompt";
import { ConnectionAgentSelectionFlow } from "./ConnectionAgentSelectionFlow";
import { ConnectionCredentialResolver } from "./CredentialResolver";
import { ConnectionOnboardingPrompts } from "./ConnectionOnboardingPrompts";

export type ConnectionAddInput = {
  authMode: AuthMode;
  credential: StoredCredential;
  enabledAgents?: AgentId[];
  endpointUrl?: string;
  id?: string;
  label?: string;
  selectedModelId?: string;
  preset: ConnectionPresetFamily;
};

type DescribeOnboardingInput = {
  authMode: AuthMode;
  credential: StoredCredential;
  endpointUrl?: string;
  label?: string;
  preset: ConnectionPresetFamily;
};

type ConnectionAddFlowOptions = {
  credentialResolver: ConnectionCredentialResolver;
  describeOnboarding(
    options: ResolvedCliOptions,
    input: DescribeOnboardingInput,
  ): Promise<ConnectionOnboardingSuggestion>;
  onboardingPrompts: ConnectionOnboardingPrompts;
  prompt: InteractivePrompt;
};

export class ConnectionAddFlow {
  private readonly agentSelection: ConnectionAgentSelectionFlow;

  constructor(private readonly options: ConnectionAddFlowOptions) {
    this.agentSelection = new ConnectionAgentSelectionFlow(options.prompt);
  }

  async resolveInput(
    options: ResolvedCliOptions,
    flags: Map<string, string | boolean>,
  ): Promise<ConnectionAddInput> {
    const preset = this.readFlagString(flags, "preset");
    if (!preset) {
      if (!this.options.prompt.isInteractive()) {
        throw new Error("add requires --preset and --auth-mode");
      }
      return await this.promptForInput(options);
    }

    const definition = SHARED_CONNECTION_CATALOG.getDefinition(preset);
    if (!definition) {
      throw new Error(`Unsupported connection preset: ${preset}`);
    }

    const authMode = this.options.credentialResolver.requireAuthMode(this.requireFlagString(flags, "auth-mode"));
    const credential = await this.options.credentialResolver.resolveForFlags(options, flags, authMode);
    const endpointUrl = this.readFlagString(flags, "endpoint-url") ?? undefined;
    const label = this.readFlagString(flags, "label") ?? undefined;
    const agentSelection = await this.resolveAgentSelection(options, flags, definition, {
      authMode,
      credential,
      endpointUrl,
      label,
      preset: definition.preset,
    });

    return {
      authMode,
      credential,
      endpointUrl,
      id: this.readFlagString(flags, "id") ?? undefined,
      label,
      ...(agentSelection.enabledAgents ? { enabledAgents: agentSelection.enabledAgents } : {}),
      ...(agentSelection.selectedModelId ? { selectedModelId: agentSelection.selectedModelId } : {}),
      preset: definition.preset,
    };
  }

  private async promptForInput(options: ResolvedCliOptions): Promise<ConnectionAddInput> {
    while (true) {
      const definition = await this.promptForConnectionDefinition();
      const endpointUrl = await this.promptForBaseUrl(definition.requiresEndpointUrl);
      const authMode = definition.supportedAuthModes.length > 1
        ? await this.options.onboardingPrompts.promptForAuthMode(definition.supportedAuthModes)
        : definition.supportedAuthModes[0];

      try {
        const credential = await this.options.credentialResolver.promptForCredential(options, authMode);
        if (definition.preset === "gateway" && authMode === "api_key" && endpointUrl) {
          await this.options.onboardingPrompts.confirmGatewayProbe(endpointUrl);
        }
        const label = await this.options.onboardingPrompts.promptForSuggestedLabel(
          definition.preset,
          authMode,
          credential,
          endpointUrl,
        );
        const agentSelection = await this.promptForAgentSelection(options, definition, {
          authMode,
          credential,
          endpointUrl,
          label: label || undefined,
          preset: definition.preset,
        });
        return {
          authMode,
          credential,
          endpointUrl,
          label: label || undefined,
          ...(agentSelection.enabledAgents ? { enabledAgents: agentSelection.enabledAgents } : {}),
          ...(agentSelection.selectedModelId ? { selectedModelId: agentSelection.selectedModelId } : {}),
          preset: definition.preset,
        };
      } catch (error) {
        if (error instanceof Error && error.message === "Back") {
          continue;
        }
        throw error;
      }
    }
  }

  private async promptForConnectionDefinition(): Promise<ConnectionDefinition> {
    while (true) {
      const selection = await this.options.prompt.select(
        "Choose an endpoint preset",
        SHARED_CONNECTION_CATALOG.listDefinitions().map((preset) => ({
          value: preset.preset,
          label: preset.label,
        })),
        { allowBack: true, allowCancel: true },
      );
      if (selection.type === "cancel") {
        throw new Error("Cancelled");
      }
      if (selection.type === "back") {
        throw new Error("Back");
      }
      const definition = SHARED_CONNECTION_CATALOG.getDefinition(selection.value);
      if (definition) {
        return definition;
      }
    }
  }

  private async promptForBaseUrl(required: boolean): Promise<string | undefined> {
    if (!required) {
      return undefined;
    }

    while (true) {
      const input = await this.options.prompt.input("Endpoint URL", { allowBack: true, allowCancel: true });
      if (input.type === "cancel") {
        throw new Error("Cancelled");
      }
      if (input.type === "back") {
        throw new Error("Back");
      }
      if (input.value) {
        return input.value;
      }
    }
  }

  private async resolveAgentSelection(
    options: ResolvedCliOptions,
    flags: Map<string, string | boolean>,
    definition: ConnectionDefinition,
    input: DescribeOnboardingInput,
  ): Promise<{ enabledAgents?: AgentId[]; selectedModelId?: string }> {
    const requestedAgents = this.readRequestedAgents(flags);
    const selectedModelId = this.readSelectedModelId(flags);
    const onboarding = !requestedAgents && definition.configurableAgents.length <= 1 && !selectedModelId
      ? undefined
      : await this.describeOnboarding(options, input);

    return this.agentSelection.finalize({
      authMode: input.authMode,
      definition,
      onboarding,
      selectedModelId,
      requestedAgents,
    });
  }

  private async promptForAgentSelection(
    options: ResolvedCliOptions,
    definition: ConnectionDefinition,
    input: DescribeOnboardingInput,
  ): Promise<{ enabledAgents?: AgentId[]; selectedModelId?: string }> {
    const onboarding = definition.suggestEnabledAgents
      ? await this.describeOnboarding(options, input)
      : {
        configurableAgents: definition.configurableAgents,
        defaultEnabledAgents: definition.defaultEnabledAgents,
      };
    return await this.agentSelection.promptForSelection(definition, input.authMode, onboarding);
  }

  private async describeOnboarding(
    options: ResolvedCliOptions,
    input: DescribeOnboardingInput,
  ): Promise<ConnectionOnboardingSuggestion> {
    return await this.options.describeOnboarding(options, input);
  }

  private readRequestedAgents(flags: Map<string, string | boolean>): AgentId[] | undefined {
    const value = this.readFlagString(flags, "agents");
    return value ? this.agentSelection.parseRequestedAgents(value) : undefined;
  }

  private readSelectedModelId(flags: Map<string, string | boolean>): string | undefined {
    return this.readFlagString(flags, "model-id")?.trim() || undefined;
  }

  private requireFlagString(flags: Map<string, string | boolean>, name: string): string {
    const value = this.readFlagString(flags, name);
    if (!value) {
      throw new Error(`add requires --${name}`);
    }
    return value;
  }

  private readFlagString(flags: Map<string, string | boolean>, name: string): string | null {
    const value = flags.get(name);
    return typeof value === "string" ? value : null;
  }
}
