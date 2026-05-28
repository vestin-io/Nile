import type { SavedConnectionSummary } from "@nile/core/models/connection";
import type { AgentId } from "@nile/core/models/agent";
import type { RemoveConnectionResult } from "@nile/builtins/local";
import type {
  ImportDetectedSetupsInput,
  ImportDetectedSetupsResult,
  ScanLocalSetupsResult,
} from "@nile/core/actions/local-setup";
import type { CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import type { InteractiveSessionLoginRegistry } from "@nile/builtins/session";
import {
  runWithCursorUsageWorkspace,
  type ConnectionChangeResult,
} from "@nile/builtins/cursor-usage";

import { ConnectionCredentialResolver } from "./CredentialResolver";
import { ConnectionAddFlow } from "./ConnectionAddFlow";
import { ConnectionOnboardingPrompts } from "./ConnectionOnboardingPrompts";
import { CursorUsageSessionProbeFactory } from "./CursorUsageSessionProbeFactory";
import { SessionRunner } from "./SessionRunner";
import { InteractivePrompt } from "../InteractivePrompt";
import type {
  AddConnectionResult,
  ResolvedCliOptions,
} from "../types";
import { formatAgentLabel } from "@nile/core/models/agent";
import { AGENT_CAPABILITIES } from "@nile/core/models/agent";

export class ConnectionCommands {
  private readonly addFlow: ConnectionAddFlow;
  private readonly sessions: SessionRunner;
  private readonly cursorUsageSessionProbeFactory = new CursorUsageSessionProbeFactory();

  constructor(
    private readonly credentialStore: CredentialStore,
    prompt: InteractivePrompt,
    interactiveSessionLoginRegistry: Pick<InteractiveSessionLoginRegistry, "signInAndRead">,
    private readonly logger: NileLogger,
  ) {
    const credentialResolver = new ConnectionCredentialResolver(prompt, interactiveSessionLoginRegistry);
    const onboardingPrompts = new ConnectionOnboardingPrompts(prompt, credentialResolver);
    this.addFlow = new ConnectionAddFlow({
      credentialResolver,
      describeOnboarding: async (options, input) =>
        await this.sessions.runAsync(options, "describe-connection-onboarding", async (session) =>
          await session.describeConnectionOnboarding({
            ...input,
            credentialStorageBackend: this.resolveCliCredentialStorageMode(session),
          }),
        ),
      onboardingPrompts,
      prompt,
    });
    this.sessions = new SessionRunner(this.credentialStore, logger);
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
      const credentialStorageBackend = this.resolveCliCredentialStorageMode(session);
      const created = this.applyCursorUsageFollowUp(
        options,
        await session.createConnection({
          ...createInput,
          credentialStorageBackend,
        }),
      );
      this.applySelectedModelId(session, created.id, createInput.enabledAgents, selectedModelId);
      return this.buildAddConnectionResult(created);
    });
  }

  async addConnectionInteractive(options: ResolvedCliOptions): Promise<AddConnectionResult> {
    const input = await this.addFlow.resolveInput(options, new Map());
    return await this.sessions.runAsync(options, "create-connection", async (session) => {
      const { selectedModelId, ...createInput } = input;
      const credentialStorageBackend = this.resolveCliCredentialStorageMode(session);
      const created = this.applyCursorUsageFollowUp(
        options,
        await session.createConnection({
          ...createInput,
          credentialStorageBackend,
        }),
      );
      this.applySelectedModelId(session, created.id, createInput.enabledAgents, selectedModelId);
      return this.buildAddConnectionResult(created);
    });
  }

  async importCurrentConnection(options: ResolvedCliOptions, agentId: AgentId): Promise<AddConnectionResult> {
    return await this.sessions.runAsync(options, `${agentId}-import-current-connection`, async (session) => {
      this.resolveCliCredentialStorageMode(session);
      const imported = this.applyCursorUsageFollowUp(
        options,
        await session.importCurrentConnection(agentId, {
          credentialStorageBackend: "system_secure_storage",
        }),
      );
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
    return await this.sessions.runAsync(options, "import-detected-setups", async (session) => {
      const credentialStorageBackend = this.resolveCliCredentialStorageMode(session);
      return await session.importDetectedSetups({
        ...input,
        credentialStorageBackend,
      });
    });
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

  private applyCursorUsageFollowUp<T extends ConnectionChangeResult>(
    options: ResolvedCliOptions,
    result: T,
  ): T {
    return runWithCursorUsageWorkspace({
      databasePath: options.databasePath,
      credentialStore: this.credentialStore,
      sessionProbe: this.cursorUsageSessionProbeFactory.create(options),
      logger: this.logger,
    }, (workspace) => workspace.applyFollowUp(result));
  }

  private applySelectedModelId(
    session: { setAgentConnectionModel(agentId: AgentId, connectionId: string, modelId: string): void },
    connectionId: string,
    enabledAgents: AgentId[] | undefined,
    selectedModelId: string | undefined,
  ): void {
    if (!selectedModelId?.trim() || !enabledAgents?.length) {
      return;
    }

    for (const agentId of enabledAgents) {
      if (!AGENT_CAPABILITIES.read(agentId).requiredApplyRequirements.includes("selected-model")) {
        continue;
      }
      session.setAgentConnectionModel(agentId, connectionId, selectedModelId);
    }
  }

  private resolveCliCredentialStorageMode(
    session: Pick<ConnectionCommandsSession, "listSavedConnections">,
  ): "system_secure_storage" {
    const modes = [...new Set(session
      .listSavedConnections()
      .map((connection) => connection.credentialStorageBackend)
      .filter((backend): backend is "system_secure_storage" | "encrypted_local_storage" =>
        backend === "system_secure_storage" || backend === "encrypted_local_storage",
      ))];

    if (modes.length > 1) {
      throw new Error(
        "Saved connections on this machine use multiple credential storage backends. Reset local state in the desktop app before using CLI save or import commands.",
      );
    }

    if (modes[0] === "encrypted_local_storage") {
      throw new Error(
        "This machine is configured to use Encrypted local storage. Save or import connections from the desktop app after unlocking encrypted local storage, or reset local state to choose a new storage mode.",
      );
    }

    return "system_secure_storage";
  }
}

type ConnectionCommandsSession = {
  listSavedConnections(): SavedConnectionSummary[];
};
