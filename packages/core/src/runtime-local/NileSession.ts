import { LocalWorkspaceState } from "../application/local/WorkspaceState";
import { LocalCredentialResolver } from "../application/local/LocalCredentialResolver";
import type { CursorUsageSessionProbe } from "../application/local/CursorUsageSessionProbe";
import {
  type ImportDetectedSetupsInput,
  type ImportDetectedSetupsResult,
  type ScanLocalSetupsResult,
} from "../actions/scan-local";
import { AgentAdapterRegistry } from "./AgentAdapterRegistry";
import type {
  ApplyAgentSelectionResult,
  AgentAdapterCapabilities,
  ImportCurrentConnectionResult,
  RollbackLatestAgentResult,
} from "./AgentAdapterTypes";
import type { CreateConnectionInput, CreateConnectionResult } from "../models/connection/Creator";
import type { ConnectionOnboardingSuggestion } from "../models/connection/OnboardingPolicy";
import type { AgentHomes } from "../models/agent/Homes";
import { defaultAgentHomes, mergeAgentHomes } from "../models/agent/Homes";
import type { AgentId } from "../models/agent/Types";
import type { SavedConnectionSummary } from "../models/connection/SavedConnections";
import { AgentSelection } from "../models/selection/Selection";
import type { CredentialStore } from "../services/credential/Store";
import type { StoredCredential } from "../services/credential/Types";
import { SqliteDatabase } from "../services/database/SqliteDatabase";
import { EnvironmentSource, type EnvironmentSource as EnvironmentSourceType } from "../services/EnvironmentSource";
import { MutationHistory } from "../services/history/MutationHistory";
import type { MutationHistoryRecord } from "../services/history/MutationHistoryTypes";
import type { SecureSnapshotStore } from "../services/history/SecureSnapshotStore";
import type { NileLogger } from "../services/NileLogger";
import { CodexSessionLogin } from "../agents/codex/CodexSessionLogin";
import { SessionConnections } from "./Connections";
import { SessionAgents } from "./Agents";
import { SessionUsageAccess } from "./UsageAccess";
import type { ConnectionUsageResult } from "../actions/usage/Result";
import type { BindCursorUsageResult } from "../actions/usage/cursor/Binder";
import type { CursorUsageAutoBindResult } from "../application/local/CursorUsageAutoBinder";
import type { AgentStatusView } from "../actions/status/Status";
import type { CreateLocalConnectionInput, RemoveConnectionResult, UpdateConnectionInput } from "./ConnectionTypes";

type LocalEffectResult = {
  id: string;
  endpointFamily: string;
  authMode: string;
};

export type NileSessionOpenOptions = {
  databasePath: string;
  credentialStore: CredentialStore;
  environment?: EnvironmentSourceType;
  secureSnapshotStore?: SecureSnapshotStore;
  logger?: NileLogger;
  /** Overrides default `~/.codex`, `~/.cursor`, `~/.claude` install roots. */
  agentHomes?: AgentHomes;
  cursorUsageSessionProbe?: CursorUsageSessionProbe;
};

/**
 * One SQLite database and shared registries for a CLI command or desktop request.
 * Close when the unit of work completes.
 */
export class NileSession {
  static open(options: NileSessionOpenOptions): NileSession {
    const database = SqliteDatabase.open(options.databasePath);
    return new NileSession(
      options.databasePath,
      database,
      options.credentialStore,
      mergeAgentHomes(defaultAgentHomes(), options.agentHomes),
      {
        environment: options.environment,
        secureSnapshotStore: options.secureSnapshotStore,
        logger: options.logger,
        cursorUsageSessionProbe: options.cursorUsageSessionProbe,
      },
    );
  }

  private workspaceState: LocalWorkspaceState | null = null;
  private agentSelection: AgentSelection | null = null;
  private adapterRegistry: AgentAdapterRegistry | null = null;
  private history: MutationHistory | null = null;
  private connections: SessionConnections | null = null;
  private agents: SessionAgents | null = null;
  private usageAccess: SessionUsageAccess | null = null;

  private constructor(
    private readonly databasePath: string,
    private readonly database: SqliteDatabase,
    private readonly credentialStore: CredentialStore,
    private readonly agentHomes: AgentHomes,
    private readonly extras: {
      environment?: EnvironmentSourceType;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
      cursorUsageSessionProbe?: CursorUsageSessionProbe;
    },
  ) {}

  private getWorkspaceState(): LocalWorkspaceState {
    return (this.workspaceState ??= LocalWorkspaceState.fromDatabase(
      this.database,
      this.credentialStore,
      undefined,
      this.databasePath,
    ));
  }

  private getAgentSelection(): AgentSelection {
    return (this.agentSelection ??= AgentSelection.fromDatabase(this.database));
  }

  private getAgentAdapterRegistry(): AgentAdapterRegistry {
    return (this.adapterRegistry ??= AgentAdapterRegistry.fromSharedContext(
      this.getWorkspaceState().createSharedAgentAdapterContext(this.getAgentSelection()),
      {
        credentialStore: this.credentialStore,
        environment: this.extras.environment,
        secureSnapshotStore: this.extras.secureSnapshotStore,
        logger: this.extras.logger,
        agentHomes: this.agentHomes,
      },
    ));
  }

  private getConnections(): SessionConnections {
    return (this.connections ??= new SessionConnections(
      this.getWorkspaceState().createSavedConnections(this.getAgentSelection()),
      this.getWorkspaceState().createConnectionCreator(),
      () => this.createLocalCredentialResolver(),
    ));
  }

  private getAgents(): SessionAgents {
    if (this.agents) {
      return this.agents;
    }

    const workspaceState = this.getWorkspaceState();
    const agentAdapterRegistry = this.getAgentAdapterRegistry();
    const agentActions = workspaceState.createAgentActions(agentAdapterRegistry);

    this.agents = new SessionAgents(
      agentAdapterRegistry,
      agentActions.status,
      agentActions.scanLocal,
      agentActions.importDetectedSetups,
      (scope) => this.getMutationHistory(scope),
    );
    return this.agents;
  }

  private getUsageAccess(): SessionUsageAccess {
    return (this.usageAccess ??= new SessionUsageAccess(
      this.getWorkspaceState(),
      this.getWorkspaceState().createUsage(),
      this.extras.cursorUsageSessionProbe,
    ));
  }

  private getMutationHistory(scope?: string): MutationHistory {
    if (!scope) {
      return (this.history ??= this.createMutationHistory("mutation-history"));
    }
    return this.createMutationHistory(scope);
  }

  listSavedConnections(): SavedConnectionSummary[] {
    return this.getConnections().list();
  }

  listSavedConnectionsForAgent(agentId: AgentId): SavedConnectionSummary[] {
    return this.getConnections().listForAgent(agentId);
  }

  readConnectionCredential(connectionId: string): StoredCredential {
    return this.getConnections().readCredential(connectionId);
  }

  removeConnection(connectionId: string): RemoveConnectionResult {
    this.getUsageAccess().clearConnectionArtifacts(connectionId);
    return this.getConnections().remove(connectionId);
  }

  async updateConnection(input: UpdateConnectionInput): Promise<SavedConnectionSummary> {
    return await this.getConnections().update(input, this.createLocalCredentialResolver());
  }

  useConnection(agentId: AgentId, connectionId: string): ApplyAgentSelectionResult {
    return this.getAgents().useConnection(agentId, connectionId);
  }

  getAgentStatus(agentId: AgentId): AgentStatusView {
    return this.getAgents().getStatus(agentId);
  }

  listAgentStatuses(agentIds?: AgentId[]): AgentStatusView[] {
    return this.getAgents().listStatuses(agentIds);
  }

  scanLocalSetups(agentIds?: AgentId[]): ScanLocalSetupsResult {
    return this.getAgents().scanLocalSetups(agentIds);
  }

  importDetectedSetups(input: ImportDetectedSetupsInput): ImportDetectedSetupsResult {
    return this.getAgents().importDetected(input);
  }

  getConnectionUsage(connectionId: string): Promise<ConnectionUsageResult> {
    return this.getUsageAccess().getConnectionUsage(connectionId);
  }

  bindCursorUsage(connectionId: string, sessionToken: string): BindCursorUsageResult {
    return this.getUsageAccess().bindCursorUsage(connectionId, sessionToken);
  }

  autoBindCursorUsage(connectionId: string): CursorUsageAutoBindResult {
    return this.getUsageAccess().autoBindCursorUsage(connectionId);
  }

  autoBindAllCursorUsage(): CursorUsageAutoBindResult[] {
    return this.getUsageAccess().autoBindAllCursorUsage();
  }

  async describeConnectionOnboarding(input: CreateConnectionInput): Promise<ConnectionOnboardingSuggestion> {
    return await this.getConnections().describeOnboarding(input);
  }

  async createConnection(input: CreateConnectionInput): Promise<CreateConnectionResult> {
    return await this.getConnections().create(input);
  }

  async createConnectionWithLocalEffects(input: CreateConnectionInput): Promise<CreateConnectionResult> {
    return await this.applyLocalEffects(this.createConnection(input));
  }

  async createLocalConnection(
    input: CreateLocalConnectionInput,
    localCredentialResolver: LocalCredentialResolver = this.createLocalCredentialResolver(),
  ): Promise<CreateConnectionResult> {
    return await this.getConnections().createLocalWithResolver(input, localCredentialResolver);
  }

  async createLocalConnectionWithLocalEffects(
    input: CreateLocalConnectionInput,
    localCredentialResolver: LocalCredentialResolver = this.createLocalCredentialResolver(),
  ): Promise<CreateConnectionResult> {
    return await this.applyLocalEffects(
      this.createLocalConnection(input, localCredentialResolver),
    );
  }

  async describeLocalConnectionOnboarding(
    input: CreateLocalConnectionInput,
    localCredentialResolver: LocalCredentialResolver = this.createLocalCredentialResolver(),
  ): Promise<ConnectionOnboardingSuggestion> {
    return await this.getConnections().describeLocalOnboardingWithResolver(input, localCredentialResolver);
  }

  importCurrentConnection(agentId: AgentId): ImportCurrentConnectionResult {
    return this.getAgents().importCurrentConnection(agentId);
  }

  importCurrentConnectionWithLocalEffects(agentId: AgentId): ImportCurrentConnectionResult {
    return this.applyResolvedLocalEffects(this.importCurrentConnection(agentId));
  }

  rollbackLatestMutation(agentId: AgentId): RollbackLatestAgentResult {
    return this.getAgents().rollbackLatestMutation(agentId);
  }

  listAgentCapabilities(): Array<{ agentId: AgentId; capabilities: AgentAdapterCapabilities }> {
    return this.getAgents().listCapabilities();
  }

  getLatestRollbackableMutation(agentId: AgentId, scope?: string): MutationHistoryRecord | null {
    return this.getMutationHistory(scope).findLatestRollbackCandidate(agentId);
  }

  listMutationHistory(limit: number = 20, scope?: string): MutationHistoryRecord[] {
    return this.getMutationHistory(scope).list(limit);
  }

  private createLocalCredentialResolver(
    codexSessionLogin: CodexSessionLogin = new CodexSessionLogin(),
  ): LocalCredentialResolver {
    return new LocalCredentialResolver(
      this.agentHomes,
      this.extras.environment ?? EnvironmentSource.empty(),
      codexSessionLogin,
    );
  }

  private tryAutoBindCursorUsage(
    connectionId: string,
    endpointFamily: string,
    authMode: string,
  ): void {
    if (endpointFamily !== "cursor" || authMode !== "cursor_session") {
      return;
    }

    try {
      this.autoBindCursorUsage(connectionId);
    } catch (error) {
      this.extras.logger?.warn("session.cursor_usage.auto_bind_failed", {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async applyLocalEffects<T extends LocalEffectResult>(result: Promise<T>): Promise<T> {
    return this.applyResolvedLocalEffects(await result);
  }

  private applyResolvedLocalEffects<T extends LocalEffectResult>(result: T): T {
    this.tryAutoBindCursorUsage(result.id, result.endpointFamily, result.authMode);
    return result;
  }

  private createMutationHistory(scope?: string): MutationHistory {
    return MutationHistory.fromDatabase(this.databasePath, this.database, {
      secureSnapshotStore: this.extras.secureSnapshotStore,
      logger: scope ? this.extras.logger?.child({ scope }) : this.extras.logger,
    });
  }

  close(): void {
    this.database.close();
  }
}
