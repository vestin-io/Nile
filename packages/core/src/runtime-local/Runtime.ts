import { LocalWorkspaceState, type LocalAgentActions } from "../application/local/WorkspaceState";
import { LocalCredentialResolver } from "../application/local/LocalCredentialResolver";
import type { CursorUsageSessionProbe } from "../application/local/CursorUsageSessionProbe";
import type { AgentHomes } from "../models/agent/Homes";
import type { ConnectionCreator } from "../models/connection/Creator";
import type { SavedConnections } from "../models/connection/SavedConnections";
import { AgentSelection } from "../models/selection/Selection";
import type { CredentialStore } from "../services/credential/Store";
import { SqliteDatabase } from "../services/database/SqliteDatabase";
import { EnvironmentSource, type EnvironmentSource as EnvironmentSourceType } from "../services/EnvironmentSource";
import { MutationHistory } from "../services/history/MutationHistory";
import type { SecureSnapshotStore } from "../services/history/SecureSnapshotStore";
import type { NileLogger } from "../services/NileLogger";
import { CodexSessionLogin } from "../agents/codex/CodexSessionLogin";
import type { Usage } from "../actions/usage/Usage";
import type { ConnectionUsageResult } from "../actions/usage/Result";
import type { BindCursorUsageResult } from "../actions/usage/cursor/Binder";
import type { CursorUsageAutoBindResult } from "../application/local/CursorUsageAutoBinder";
import type { ImportDetectedSetupsInput, ImportDetectedSetupsResult, ScanLocalSetupsResult } from "../actions/scan-local";
import type { AgentStatusView } from "../actions/status/Status";
import type { MutationHistoryRecord } from "../services/history/MutationHistoryTypes";
import type { AgentId } from "../models/agent/Types";
import type {
  AgentCapabilitySupport,
  ApplyAgentSelectionResult,
  ImportCurrentConnectionResult,
  RollbackLatestAgentResult,
} from "./AgentAdapterTypes";
import { AgentAdapterRegistry } from "./AgentAdapterRegistry";
import { SessionConnections } from "./Connections";

export type NileSessionRuntimeOptions = {
  databasePath: string;
  database: SqliteDatabase;
  credentialStore: CredentialStore;
  agentHomes: AgentHomes;
  environment?: EnvironmentSourceType;
  secureSnapshotStore?: SecureSnapshotStore;
  logger?: NileLogger;
  cursorUsageSessionProbe?: CursorUsageSessionProbe;
};

export class NileSessionRuntime {
  private workspaceState: LocalWorkspaceState | null = null;
  private agentSelection: AgentSelection | null = null;
  private adapterRegistry: AgentAdapterRegistry | null = null;
  private agentActions: LocalAgentActions | null = null;
  private history: MutationHistory | null = null;
  private savedConnections: SavedConnections | null = null;
  private connectionCreator: ConnectionCreator | null = null;
  private connectionWorkflows: SessionConnections | null = null;
  private usage: Usage | null = null;

  constructor(private readonly options: NileSessionRuntimeOptions) {}

  getSavedConnections(): SavedConnections {
    return (this.savedConnections ??= this.getWorkspaceState().createSavedConnections(this.getAgentSelection()));
  }

  getConnectionCreator(): ConnectionCreator {
    return (this.connectionCreator ??= this.getWorkspaceState().createConnectionCreator());
  }

  getConnectionWorkflows(): SessionConnections {
    return (this.connectionWorkflows ??= new SessionConnections(
      this.getSavedConnections(),
      this.getConnectionCreator(),
      () => this.createLocalCredentialResolver(),
    ));
  }

  useConnection(agentId: AgentId, connectionId: string): ApplyAgentSelectionResult {
    return this.getAgentAdapterRegistry().get(agentId).applySelection(connectionId);
  }

  getAgentStatus(agentId: AgentId): AgentStatusView {
    return this.getAgentActions().status.get(agentId);
  }

  listAgentStatuses(agentIds?: AgentId[]): AgentStatusView[] {
    return this.getAgentActions().status.list(agentIds);
  }

  scanLocalSetups(agentIds?: AgentId[]): ScanLocalSetupsResult {
    return this.getAgentActions().scanLocal.run(agentIds);
  }

  importDetectedSetups(input: ImportDetectedSetupsInput): ImportDetectedSetupsResult {
    return this.getAgentActions().importDetectedSetups.run(input);
  }

  importCurrentConnection(agentId: AgentId): ImportCurrentConnectionResult {
    return this.getAgentAdapterRegistry().get(agentId).importCurrentConnection();
  }

  rollbackLatestMutation(agentId: AgentId): RollbackLatestAgentResult {
    return this.getAgentAdapterRegistry().get(agentId).rollbackLatestMutation();
  }

  listAgentRollbackSupport(): Array<{ agentId: AgentId; rollback: AgentCapabilitySupport }> {
    return this.getAgentAdapterRegistry().listRollbackSupport();
  }

  getLatestRollbackableMutation(agentId: AgentId, scope?: string): MutationHistoryRecord | null {
    return this.getMutationHistory(scope).findLatestRollbackCandidate(agentId);
  }

  listMutationHistory(limit: number = 20, scope?: string): MutationHistoryRecord[] {
    return this.getMutationHistory(scope).list(limit);
  }

  getConnectionUsage(connectionId: string): Promise<ConnectionUsageResult> {
    return this.getUsage().get(connectionId);
  }

  bindCursorUsage(connectionId: string, sessionToken: string): BindCursorUsageResult {
    return this.getWorkspaceState().createCursorUsageBinder().bind(connectionId, sessionToken);
  }

  autoBindCursorUsage(connectionId: string): CursorUsageAutoBindResult {
    return this.getWorkspaceState().createCursorUsageAutoBinder(this.options.cursorUsageSessionProbe).autoBind(connectionId);
  }

  autoBindAllCursorUsage(): CursorUsageAutoBindResult[] {
    return this.getWorkspaceState().createCursorUsageAutoBinder(this.options.cursorUsageSessionProbe).autoBindAllMissing();
  }

  clearConnectionArtifacts(connectionId: string): void {
    this.getWorkspaceState().clearCursorUsageArtifacts(connectionId);
  }

  getMutationHistory(scope?: string): MutationHistory {
    if (!scope) {
      return (this.history ??= this.createMutationHistory("mutation-history"));
    }
    return this.createMutationHistory(scope);
  }

  getLogger(): NileLogger | undefined {
    return this.options.logger;
  }

  createLocalCredentialResolver(
    codexSessionLogin: CodexSessionLogin = new CodexSessionLogin(
      this.options.environment ?? EnvironmentSource.empty(),
    ),
  ): LocalCredentialResolver {
    return new LocalCredentialResolver(
      this.options.agentHomes,
      this.options.environment ?? EnvironmentSource.empty(),
      codexSessionLogin,
    );
  }

  close(): void {
    this.options.database.close();
  }

  private getWorkspaceState(): LocalWorkspaceState {
    return (this.workspaceState ??= LocalWorkspaceState.fromDatabase(
      this.options.database,
      this.options.credentialStore,
      undefined,
      this.options.databasePath,
    ));
  }

  private getAgentSelection(): AgentSelection {
    return (this.agentSelection ??= AgentSelection.fromDatabase(this.options.database));
  }

  private getAgentAdapterRegistry(): AgentAdapterRegistry {
    return (this.adapterRegistry ??= AgentAdapterRegistry.fromSharedContext(
      this.getWorkspaceState().createSharedAgentAdapterContext(this.getAgentSelection()),
      {
        credentialStore: this.options.credentialStore,
        environment: this.options.environment,
        secureSnapshotStore: this.options.secureSnapshotStore,
        logger: this.options.logger,
        agentHomes: this.options.agentHomes,
      },
    ));
  }

  private getAgentActions(): LocalAgentActions {
    return (this.agentActions ??= this.getWorkspaceState().createAgentActions(this.getAgentAdapterRegistry()));
  }

  private getUsage(): Usage {
    return (this.usage ??= this.getWorkspaceState().createUsage());
  }

  private createMutationHistory(scope?: string): MutationHistory {
    return MutationHistory.fromDatabase(this.options.databasePath, this.options.database, {
      secureSnapshotStore: this.options.secureSnapshotStore,
      logger: scope ? this.options.logger?.child({ scope }) : this.options.logger,
    });
  }
}
