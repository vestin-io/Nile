import type { AgentHomes, AgentId, ImportCurrentConnectionResult, RollbackLatestAgentResult } from "@nile/core/models/agent";
import type { ImportDetectedSetupsResult } from "@nile/core/actions/local-setup";
import type { RemoveConnectionResult } from "@nile/builtins/local";
import type {
  BindCursorUsageResult,
  CursorUsageAutoBindResult,
  ConnectionChangeResult,
  CursorUsageWorkspace,
} from "@nile/builtins/cursor-usage";
import { runWithCursorUsageWorkspace as runWithCursorUsageWorkspaceImpl } from "@nile/builtins/cursor-usage";
import { NileSession } from "@nile/builtins/runtime";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import type { CredentialStore } from "@nile/core/services/credential";
import type { SavedConnectionSummary } from "@nile/core/models/connection";
import { CursorUsageSessionSourceProbe } from "@nile/host-local";

import { DesktopConnectionStatusPresenter } from "../../state/connection/Status";
import type { DesktopConnection } from "../../state/Types";
import { DesktopManagedConnectionImports } from "./Imports";
import { ManagedApiKeyEnvironment, NoopManagedApiKeyEnvironment } from "./ManagedApiKeyEnvironment";
import { SessionRunner } from "./SessionRunner";
import type { DesktopConnectionSummary } from "./contracts";

type DesktopConnectionGatewayOptions = {
  databasePath: string;
  agentHomes?: AgentHomes;
  environment: EnvironmentSource;
  managedApiKeyEnvironment?: ManagedApiKeyEnvironment;
  credentialStore: CredentialStore;
};

export class DesktopConnectionGateway {
  private readonly cursorUsageSessionProbe = CursorUsageSessionSourceProbe.createDefault();
  private readonly sessions: SessionRunner;
  private readonly status = new DesktopConnectionStatusPresenter();
  private readonly managedApiKeyEnvironment: ManagedApiKeyEnvironment | NoopManagedApiKeyEnvironment;
  private readonly imports: DesktopManagedConnectionImports;

  constructor(private readonly options: DesktopConnectionGatewayOptions) {
    this.managedApiKeyEnvironment = this.options.managedApiKeyEnvironment ?? new NoopManagedApiKeyEnvironment();
    this.imports = new DesktopManagedConnectionImports(this.managedApiKeyEnvironment);
    this.sessions = new SessionRunner(this);
  }

  async importCurrentConnection(agentId: AgentId): Promise<DesktopConnectionSummary> {
    return await this.sessions.runAsync(async (session) => {
      const imported = await this.imports.importCurrentConnection(session, agentId);
      return this.buildConnectionSummary(this.applyCursorUsageFollowUp(imported));
    });
  }

  removeConnection(connectionId: string): RemoveConnectionResult {
    return this.sessions.run((session) => {
      this.managedApiKeyEnvironment.removeForConnection(session, connectionId);
      return session.removeConnection(connectionId);
    });
  }

  updateAgentConnectionModel(agentId: AgentId, connectionId: string, modelId: string | null): string | null {
    return this.sessions.run((session) => session.setAgentConnectionModel(agentId, connectionId, modelId));
  }

  async switchConnection(agentId: AgentId, connectionId: string): Promise<DesktopConnection> {
    return await this.sessions.runAsync(async (session) => {
      await this.enableAgentForConnectionIfNeeded(session, agentId, connectionId);
      const applied = session.useConnection(agentId, connectionId);
      const status = session.getAgentStatus(agentId);
      const currentConnection = this.status.resolveCurrentConnection(
        status.currentConnection,
        session.listSavedConnections(),
      );
      if (!currentConnection) {
        throw new Error(`Current connection missing after apply for ${applied.endpointId}/${applied.accessId}`);
      }
      return currentConnection;
    });
  }

  private async enableAgentForConnectionIfNeeded(
    session: NileSession,
    agentId: AgentId,
    connectionId: string,
  ): Promise<void> {
    const connection = session.listSavedConnections().find((candidate) => candidate.id === connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }
    if (connection.enabledAgents.includes(agentId) || !connection.configurableAgents.includes(agentId)) {
      return;
    }

    await session.updateConnection({
      connectionId,
      enabledAgents: [...connection.enabledAgents, agentId],
    });
  }

  async importDetectedSetups(scanIds: AgentId[]): Promise<ImportDetectedSetupsResult> {
    return await this.sessions.runAsync(async (session) => {
      return await this.imports.importDetectedSetups(session, scanIds);
    });
  }

  rollbackLatestMutation(agentId: AgentId): RollbackLatestAgentResult {
    return this.sessions.run((session) => session.rollbackLatestMutation(agentId));
  }

  bindCursorUsage(connectionId: string, sessionToken: string): BindCursorUsageResult {
    return this.runCursorUsageWorkspace((workspace) => workspace.bind(connectionId, sessionToken));
  }

  autoBindAllCursorUsage(): CursorUsageAutoBindResult[] {
    return this.runCursorUsageWorkspace((workspace) => workspace.autoBindAllMissing());
  }

  openSession(): NileSession {
    return NileSession.open({
      databasePath: this.options.databasePath,
      agentHomes: this.options.agentHomes,
      environment: this.options.environment,
      credentialStore: this.options.credentialStore,
    });
  }

  private applyCursorUsageFollowUp<T extends ConnectionChangeResult>(result: T): T {
    return this.runCursorUsageWorkspace((workspace) => workspace.applyFollowUp(result));
  }

  private runCursorUsageWorkspace<TResult>(
    work: (workspace: CursorUsageWorkspace) => TResult,
  ): TResult {
    return runWithCursorUsageWorkspaceImpl({
      databasePath: this.options.databasePath,
      credentialStore: this.options.credentialStore,
      sessionProbe: this.cursorUsageSessionProbe,
    }, work);
  }

  private buildConnectionSummary(
    result: ImportCurrentConnectionResult | SavedConnectionSummary,
  ): DesktopConnectionSummary {
    return {
      id: result.id,
      label: result.label,
      endpointId: result.endpointId,
      endpointLabel: result.endpointLabel,
      endpointFamily: result.endpointFamily ?? "unknown",
      authMode: result.authMode,
      ...("reused" in result && result.reused ? { reused: true } : {}),
    };
  }
}
