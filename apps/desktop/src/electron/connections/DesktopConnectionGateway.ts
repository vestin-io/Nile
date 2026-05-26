import type { AgentHomes, AgentId, ImportCurrentConnectionResult, RollbackLatestAgentResult } from "@nile/core/models/agent";
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
import type {
  CredentialStorageBackend,
  CredentialStore,
} from "@nile/core/services/credential";
import type { SavedConnectionSummary } from "@nile/core/models/connection";
import { NileLogger } from "@nile/core/services/NileLogger";
import { CursorUsageSessionSourceProbe } from "@nile/host-local";

import { DesktopConnectionStatusPresenter } from "../../state/connection/Status";
import type { DesktopConnection } from "../../state/Types";
import { DesktopCredentialStorageSession } from "./CredentialStorageSession";
import { DesktopManagedConnectionImports } from "./Imports";
import { ManagedApiKeyEnvironment, NoopManagedApiKeyEnvironment } from "./ManagedApiKeyEnvironment";
import { SessionRunner } from "./SessionRunner";
import { DesktopConnectionStorageSupport } from "./StorageSupport";
import { resolveDesktopCredentialStorageMode } from "./CredentialStorageMode";
import type {
  DesktopConnectionSummary,
  DesktopImportCurrentConnectionInput,
} from "./contracts";

type DesktopConnectionGatewayOptions = {
  databasePath: string;
  agentHomes?: AgentHomes;
  environment: EnvironmentSource;
  managedApiKeyEnvironment?: ManagedApiKeyEnvironment;
  credentialStore: CredentialStore;
  credentialStorageSession?: DesktopCredentialStorageSession;
  logger?: NileLogger;
};

export class DesktopConnectionGateway {
  private readonly cursorUsageSessionProbe = CursorUsageSessionSourceProbe.createDefault();
  private readonly sessions: SessionRunner;
  private readonly status = new DesktopConnectionStatusPresenter();
  private readonly managedApiKeyEnvironment: ManagedApiKeyEnvironment | NoopManagedApiKeyEnvironment;
  private readonly imports: DesktopManagedConnectionImports;
  private readonly logger: NileLogger;
  private readonly storage: DesktopConnectionStorageSupport;

  constructor(private readonly options: DesktopConnectionGatewayOptions) {
    this.logger = this.options.logger ?? NileLogger.silent().child({ scope: "connection-gateway" });
    this.managedApiKeyEnvironment = this.options.managedApiKeyEnvironment ?? new NoopManagedApiKeyEnvironment();
    this.imports = new DesktopManagedConnectionImports(
      this.managedApiKeyEnvironment,
      this.logger.child({ feature: "managed-imports" }),
    );
    this.sessions = new SessionRunner(this);
    this.storage = new DesktopConnectionStorageSupport(this.options.credentialStorageSession ?? null);
  }

  async importCurrentConnection(
    input: DesktopImportCurrentConnectionInput | AgentId,
  ): Promise<DesktopConnectionSummary> {
    const normalizedInput = typeof input === "string" ? { agentId: input } : input;
    const startedAt = Date.now();
    let credentialStorageBackend: CredentialStorageBackend | undefined;
    this.logger.info("desktop.import_current_connection.gateway.start", {
      agentId: normalizedInput.agentId,
      credentialStorageBackend: normalizedInput.credentialStorageBackend ?? "unset",
    });
    try {
      return await this.sessions.runAsync(async (session) => {
        credentialStorageBackend = resolveDesktopCredentialStorageMode(
          session,
          normalizedInput.credentialStorageBackend,
        );
        this.logger.info("desktop.import_current_connection.gateway.prepare_storage.start", {
          agentId: normalizedInput.agentId,
          credentialStorageBackend,
        });
        this.storage.prepare(credentialStorageBackend, normalizedInput.encryptedLocalPassphrase, {
          allowCreate: true,
        });
        this.logger.info("desktop.import_current_connection.gateway.prepare_storage.succeeded", {
          agentId: normalizedInput.agentId,
          credentialStorageBackend,
          durationMs: Date.now() - startedAt,
        });
        const imported = await this.imports.importCurrentConnection(session, {
          ...normalizedInput,
          credentialStorageBackend,
        });
        this.logger.info("desktop.import_current_connection.gateway.cursor_usage_followup.start", {
          agentId: normalizedInput.agentId,
          connectionId: imported.id,
          durationMs: Date.now() - startedAt,
        });
        const result = this.buildConnectionSummary(this.applyCursorUsageFollowUp(imported));
        this.logger.info("desktop.import_current_connection.gateway.succeeded", {
          agentId: normalizedInput.agentId,
          connectionId: result.id,
          reused: result.reused ?? false,
          durationMs: Date.now() - startedAt,
        });
        return result;
      });
    } catch (error) {
      this.logger.error("desktop.import_current_connection.gateway.failed", error, {
        agentId: normalizedInput.agentId,
        durationMs: Date.now() - startedAt,
      });
      throw this.storage.mapError(error, credentialStorageBackend);
    }
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
