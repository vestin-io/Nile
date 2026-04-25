import { SHARED_CONNECTION_AGENT_POLICY, SHARED_CONNECTION_CATALOG } from "@nile/core/models/connection";
import type { ConnectionDefinition } from "@nile/core/models/connection";
import type { SavedConnectionSummary } from "@nile/core/models/connection";
import type { ConnectionOnboardingSuggestion } from "@nile/core/models/connection";
import type { AgentId } from "@nile/core/models/agent";
import type { AuthMode } from "@nile/core/models/access";
import type { ConnectionPresetFamily } from "@nile/core/models/connection";
import type { ImportDetectedSetupsInput, ImportDetectedSetupsResult, RemoveConnectionResult, ScanLocalSetupsResult } from "@nile/core/runtime-local";
import type { CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import { CodexSessionLogin } from "@nile/core/agents";
import type { StoredCredential } from "@nile/core/services/credential";
import { CursorUsageSessionSourceProbe } from "@nile/host-local";

import { ConnectionCredentialResolver } from "./CredentialResolver";
import { ConnectionOnboardingPrompts } from "./ConnectionOnboardingPrompts";
import { SessionRunner } from "./SessionRunner";
import { InteractivePrompt } from "../InteractivePrompt";
import type {
  AddConnectionResult,
  ResolvedCliOptions,
} from "../types";
import { formatAgentLabel } from "../formatters";

export class ConnectionCommands {
  private readonly credentialResolver: ConnectionCredentialResolver;
  private readonly onboardingPrompts: ConnectionOnboardingPrompts;
  private readonly sessions: SessionRunner;

  constructor(
    credentialStore: CredentialStore,
    private readonly prompt: InteractivePrompt,
    loginRunner: CodexSessionLogin,
    private readonly logger: NileLogger,
  ) {
    this.credentialResolver = new ConnectionCredentialResolver(prompt, loginRunner);
    this.onboardingPrompts = new ConnectionOnboardingPrompts(prompt, this.credentialResolver);
    this.sessions = new SessionRunner(credentialStore, logger, CursorUsageSessionSourceProbe.createDefault());
  }

  listConnections(options: ResolvedCliOptions): SavedConnectionSummary[] {
    return this.sessions.run(options, "connections", (session) => {
      return session.listSavedConnections().map((connection) => ({
        ...connection,
        selectedByAgents: connection.selectedByAgents.map((agentId) => formatAgentLabel(agentId)),
      }));
    });
  }

  listConnectionsForAgent(options: ResolvedCliOptions, agentId: AgentId): SavedConnectionSummary[] {
    return this.sessions.run(options, "connections", (session) => {
      return session.listSavedConnectionsForAgent(agentId).map((connection) => ({
        ...connection,
        selectedByAgents: connection.selectedByAgents.map((selectedAgentId) => formatAgentLabel(selectedAgentId)),
      }));
    });
  }

  removeConnection(options: ResolvedCliOptions, connectionId: string): RemoveConnectionResult {
    return this.sessions.run(options, "connections", (session) => session.removeConnection(connectionId));
  }

  async addConnection(
    options: ResolvedCliOptions,
    flags: Map<string, string | boolean>,
  ): Promise<AddConnectionResult> {
    const preset = this.getFlagString(flags, "preset");

    if (!preset) {
      if (!this.prompt.isInteractive()) {
        throw new Error("add requires --preset and --auth-mode");
      }
      return this.addConnectionInteractive(options);
    }

    const definition = SHARED_CONNECTION_CATALOG.getDefinition(preset);
    if (!definition) {
      throw new Error(`Unsupported connection preset: ${preset}`);
    }

    const authMode = this.getFlagString(flags, "auth-mode");
    if (!authMode) {
      throw new Error("add requires --auth-mode");
    }
    const normalizedAuthMode = this.credentialResolver.requireAuthMode(authMode);
    const credential = this.credentialResolver.resolveForFlags(options, flags, normalizedAuthMode);
    const endpointUrl = this.getFlagString(flags, "endpoint-url") ?? undefined;
    const agentSelection = await this.resolveAgentSelection(options, flags, definition, {
      preset: definition.preset,
      authMode: normalizedAuthMode,
      credential,
      endpointUrl,
      label: this.getFlagString(flags, "label") ?? undefined,
    });

    return await this.sessions.runAsync(options, "create-connection", async (session) => {
      const created = await session.createConnectionWithLocalEffects({
        preset: definition.preset,
        authMode: normalizedAuthMode,
        credential,
        endpointUrl,
        id: this.getFlagString(flags, "id") ?? undefined,
        label: this.getFlagString(flags, "label") ?? undefined,
        ...(agentSelection.enabledAgents ? { enabledAgents: agentSelection.enabledAgents } : {}),
        ...(agentSelection.openclawModelId ? { openclawModelId: agentSelection.openclawModelId } : {}),
      });
      return {
        id: created.id,
        label: created.label,
        endpointId: created.endpointId,
        endpointLabel: created.endpointLabel,
        endpointFamily: created.endpointFamily,
        authMode: created.authMode,
        ...(created.reused ? { reused: true } : {}),
      };
    });
  }

  async addConnectionInteractive(options: ResolvedCliOptions): Promise<AddConnectionResult> {
    const input = await this.promptForInteractiveConnectionInput(options);
    return await this.sessions.runAsync(options, "create-connection", async (session) => {
      const created = await session.createConnectionWithLocalEffects({
        preset: input.preset,
        authMode: input.authMode,
        credential: input.credential,
        endpointUrl: input.endpointUrl,
        label: input.label,
        ...(input.openclawModelId ? { openclawModelId: input.openclawModelId } : {}),
        ...(input.enabledAgents ? { enabledAgents: input.enabledAgents } : {}),
      });
      return {
        id: created.id,
        label: created.label,
        endpointId: created.endpointId,
        endpointLabel: created.endpointLabel,
        endpointFamily: created.endpointFamily,
        authMode: created.authMode,
        ...(created.reused ? { reused: true } : {}),
      };
    });
  }

  importCurrentConnection(options: ResolvedCliOptions, agentId: AgentId): AddConnectionResult {
    return this.sessions.run(options, `${agentId}-import-current-connection`, (session) => {
      const imported = session.importCurrentConnectionWithLocalEffects(agentId);
      return {
        id: imported.id,
        label: imported.label,
        endpointId: imported.endpointId,
        endpointLabel: imported.endpointLabel,
        endpointFamily: imported.endpointFamily,
        authMode: imported.authMode,
        ...(imported.reused ? { reused: true } : {}),
      };
    });
  }

  scanLocalSetups(options: ResolvedCliOptions, agentIds?: AgentId[]): ScanLocalSetupsResult {
    return this.sessions.run(options, "scan-local-setups", (session) => session.scanLocalSetups(agentIds));
  }

  importDetectedSetups(
    options: ResolvedCliOptions,
    input: ImportDetectedSetupsInput,
  ): ImportDetectedSetupsResult {
    return this.sessions.run(options, "import-detected-setups", (session) => session.importDetectedSetups(input));
  }

  useConnection(
    options: ResolvedCliOptions,
    connectionId: string,
    agentId: AgentId,
  ): { id: string; label: string; endpointLabel: string; appliedAt: string } {
    return this.sessions.run(options, `${agentId}-apply-selection`, (session) => {
      this.logger.info("cli.connection.use.start", { connectionId, agentId });
      const applied = session.useConnection(agentId, connectionId);
      return {
        id: applied.connectionId,
        label: applied.connectionLabel,
        endpointLabel: applied.endpointLabel,
        appliedAt: applied.appliedAt,
      };
    });
  }

  private async promptForInteractiveConnectionInput(options: ResolvedCliOptions): Promise<{
    preset: ConnectionPresetFamily;
    authMode: AuthMode;
    credential: StoredCredential;
    endpointUrl?: string;
    label?: string;
    openclawModelId?: string;
    enabledAgents?: AgentId[];
  }> {
    while (true) {
      const definition = await this.promptForConnectionDefinition();
      const endpointUrl = await this.promptForBaseUrl(definition.requiresEndpointUrl);
      const authMode =
        definition.supportedAuthModes.length > 1
          ? await this.onboardingPrompts.promptForAuthMode(definition.supportedAuthModes)
          : definition.supportedAuthModes[0];

      try {
        const credential = await this.credentialResolver.promptForCredential(options, authMode);
        if (definition.preset === "gateway" && authMode === "api_key" && endpointUrl) {
          await this.onboardingPrompts.confirmGatewayProbe(endpointUrl);
        }
        const label = await this.onboardingPrompts.promptForSuggestedLabel(
          definition.preset,
          authMode,
          credential,
          endpointUrl,
        );
        const agentSelection = await this.promptForAgentSelection(options, definition, {
          preset: definition.preset,
          authMode,
          credential,
          endpointUrl,
          label: label || undefined,
        });
        return {
          preset: definition.preset,
          authMode,
          credential,
          endpointUrl,
          label: label || undefined,
          ...(agentSelection.openclawModelId ? { openclawModelId: agentSelection.openclawModelId } : {}),
          ...(agentSelection.enabledAgents ? { enabledAgents: agentSelection.enabledAgents } : {}),
        };
      } catch (error) {
        if (error instanceof Error && error.message === "Back") {
          continue;
        }
        throw error;
      }
    }
  }

  private async promptForConnectionDefinition() {
    while (true) {
      const selection = await this.prompt.select(
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
      const input = await this.prompt.input("Endpoint URL", { allowBack: true, allowCancel: true });
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

  private getFlagString(flags: Map<string, string | boolean>, name: string): string | null {
    const value = flags.get(name);
    return typeof value === "string" ? value : null;
  }

  private async resolveAgentSelection(
    options: ResolvedCliOptions,
    flags: Map<string, string | boolean>,
    definition: ConnectionDefinition,
    input: {
      preset: ConnectionPresetFamily;
      authMode: AuthMode;
      credential: StoredCredential;
      endpointUrl?: string;
      label?: string;
    },
  ): Promise<{ enabledAgents?: AgentId[]; openclawModelId?: string }> {
    const agentsFlag = this.getFlagString(flags, "agents");
    const openclawModelId = this.readOpenClawModelId(flags);
    const requestedAgents = agentsFlag ? this.parseEnabledAgentsFlag(agentsFlag) : undefined;
    const onboarding = !requestedAgents && definition.configurableAgents.length <= 1 && !openclawModelId
      ? undefined
      : await this.describeOnboarding(options, input);

    if (requestedAgents) {
      return this.finalizeAgentSelection({
        authMode: input.authMode,
        definition,
        enabledAgents: requestedAgents,
        hasExplicitAgents: true,
        onboarding,
        openclawModelId,
      });
    }

    const defaultEnabledAgents = definition.configurableAgents.length <= 1
      ? definition.defaultEnabledAgents
      : onboarding?.defaultEnabledAgents;
    return this.finalizeAgentSelection({
      authMode: input.authMode,
      definition,
      enabledAgents: defaultEnabledAgents,
      hasExplicitAgents: false,
      onboarding,
      openclawModelId,
    });
  }

  private async promptForAgentSelection(
    options: ResolvedCliOptions,
    definition: ConnectionDefinition,
    input: {
      preset: ConnectionPresetFamily;
      authMode: AuthMode;
      credential: StoredCredential;
      endpointUrl?: string;
      label?: string;
    },
  ): Promise<{ enabledAgents?: AgentId[]; openclawModelId?: string }> {
    const onboarding: ConnectionOnboardingSuggestion = definition.suggestEnabledAgents
      ? await this.describeOnboarding(options, input)
      : {
        configurableAgents: definition.configurableAgents,
        suggestedAgents: definition.defaultEnabledAgents,
        defaultEnabledAgents: definition.defaultEnabledAgents,
      };
    const configurableAgents = SHARED_CONNECTION_AGENT_POLICY.readSelectableAgents({
      preset: definition.preset,
      authMode: input.authMode,
      onboarding,
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
          allowDone: true,
          doneLabel: "Enable selected",
          allowBack: true,
          allowCancel: true,
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
      return {
        enabledAgents,
        openclawModelId,
      };
    }
  }

  private async describeOnboarding(
    options: ResolvedCliOptions,
    input: {
      preset: ConnectionPresetFamily;
      authMode: AuthMode;
      credential: StoredCredential;
      endpointUrl?: string;
      label?: string;
    }) {
    return await this.sessions.runAsync(options, "describe-connection-onboarding", async (session) =>
      await session.describeConnectionOnboarding({
        preset: input.preset,
        authMode: input.authMode,
        credential: input.credential,
        endpointUrl: input.endpointUrl,
        label: input.label,
      }),
    );
  }

  private parseEnabledAgentsFlag(value: string): AgentId[] {
    const agents = value
      .split(",")
      .map((item) => item.trim())
      .filter((item): item is AgentId =>
        item === "codex" || item === "claude" || item === "cursor" || item === "openclaw");
    if (agents.length === 0) {
      throw new Error("add --agents requires a comma-separated list like codex,claude,openclaw");
    }
    return [...new Set(agents)];
  }

  private readOpenClawModelId(flags: Map<string, string | boolean>): string | undefined {
    return this.getFlagString(flags, "openclaw-model-id")?.trim() || undefined;
  }

  private finalizeAgentSelection(input: {
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
    if (input.authMode !== "api_key") throw new Error("OpenClaw requires api_key access");
    if (!SHARED_CONNECTION_AGENT_POLICY.supportsAgent({
      preset: input.definition.preset,
      authMode: input.authMode,
      agentId: "openclaw",
      onboarding: input.onboarding,
    })) {
      throw new Error("OpenClaw is only available for OpenAI- or Anthropic-compatible API key connections");
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

  private uniqueAgents(agentIds: AgentId[]): AgentId[] { return [...new Set(agentIds)]; }
}
