import type { SavedConnectionSummary } from "@nile/core/models/connection";
import type { AgentId } from "@nile/core/models/agent";
import type { RemoveConnectionResult } from "@nile/core/application/local";
import type {
  ImportDetectedSetupsInput,
  ImportDetectedSetupsResult,
  ScanLocalSetupsResult,
} from "@nile/core/actions/local-setup";
import type { CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import { CodexSessionLogin } from "@nile/core/agents";
import { CursorUsageSessionSourceProbe } from "@nile/host-local";

import { ConnectionCredentialResolver } from "./CredentialResolver";
import { ConnectionAddFlow } from "./ConnectionAddFlow";
import { ConnectionOnboardingPrompts } from "./ConnectionOnboardingPrompts";
import { SessionRunner } from "./SessionRunner";
import { InteractivePrompt } from "../InteractivePrompt";
import type {
  AddConnectionResult,
  ResolvedCliOptions,
} from "../types";
import { formatAgentLabel } from "../formatters";

export class ConnectionCommands {
  private readonly addFlow: ConnectionAddFlow;
  private readonly sessions: SessionRunner;

  constructor(
    credentialStore: CredentialStore,
    prompt: InteractivePrompt,
    loginRunner: CodexSessionLogin,
    private readonly logger: NileLogger,
  ) {
    const credentialResolver = new ConnectionCredentialResolver(prompt, loginRunner);
    const onboardingPrompts = new ConnectionOnboardingPrompts(prompt, credentialResolver);
    this.addFlow = new ConnectionAddFlow({
      credentialResolver,
      describeOnboarding: async (options, input) =>
        await this.sessions.runAsync(options, "describe-connection-onboarding", async (session) =>
          await session.describeConnectionOnboarding(input),
        ),
      onboardingPrompts,
      prompt,
    });
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
    const input = await this.addFlow.resolveInput(options, flags);
    return await this.sessions.runAsync(options, "create-connection", async (session) => {
      const { selectedModelId, ...createInput } = input;
      const created = await session.createConnectionWithLocalEffects(createInput);
      if (selectedModelId) {
        session.setAgentConnectionModel("openclaw", created.id, selectedModelId);
      }
      return this.buildAddConnectionResult(created);
    });
  }

  async addConnectionInteractive(options: ResolvedCliOptions): Promise<AddConnectionResult> {
    const input = await this.addFlow.resolveInput(options, new Map());
    return await this.sessions.runAsync(options, "create-connection", async (session) => {
      const { selectedModelId, ...createInput } = input;
      const created = await session.createConnectionWithLocalEffects(createInput);
      if (selectedModelId) {
        session.setAgentConnectionModel("openclaw", created.id, selectedModelId);
      }
      return this.buildAddConnectionResult(created);
    });
  }

  async importCurrentConnection(options: ResolvedCliOptions, agentId: AgentId): Promise<AddConnectionResult> {
    return await this.sessions.runAsync(options, `${agentId}-import-current-connection`, async (session) => {
      const imported = await session.importCurrentConnectionWithLocalEffects(agentId);
      return this.buildAddConnectionResult(imported);
    });
  }

  scanLocalSetups(options: ResolvedCliOptions, agentIds?: AgentId[]): ScanLocalSetupsResult {
    return this.sessions.run(options, "scan-local-setups", (session) => session.scanLocalSetups(agentIds));
  }

  async importDetectedSetups(
    options: ResolvedCliOptions,
    input: ImportDetectedSetupsInput,
  ): Promise<ImportDetectedSetupsResult> {
    return await this.sessions.runAsync(options, "import-detected-setups", async (session) =>
      await session.importDetectedSetups(input));
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

  private buildAddConnectionResult(input: AddConnectionResult): AddConnectionResult {
    return {
      id: input.id,
      label: input.label,
      endpointId: input.endpointId,
      endpointLabel: input.endpointLabel,
      endpointFamily: input.endpointFamily,
      authMode: input.authMode,
      ...(input.reused ? { reused: true } : {}),
    };
  }
}
