import { LocalCredentialResolver } from "../application/local/LocalCredentialResolver";
import type { CursorUsageSessionProbe } from "../application/local/CursorUsageSessionProbe";
import {
  type ImportDetectedSetupsInput,
  type ImportDetectedSetupsResult,
  type ScanLocalSetupsResult,
} from "../actions/scan-local";
import type {
  ApplyAgentSelectionResult,
  AgentCapabilitySupport,
  ImportCurrentConnectionResult,
  RollbackLatestAgentResult,
} from "./AgentAdapterTypes";
import type { CreateConnectionInput, CreateConnectionResult } from "../models/connection/Creator";
import type { ConnectionOnboardingSuggestion } from "../models/connection/OnboardingPolicy";
import type { AgentHomes } from "../models/agent/Homes";
import { defaultAgentHomes, mergeAgentHomes } from "../models/agent/Homes";
import type { AgentId } from "../models/agent/Types";
import type { SavedConnectionSummary } from "../models/connection/SavedConnections";
import type { CredentialStore } from "../services/credential/Store";
import type { StoredCredential } from "../services/credential/Types";
import { SqliteDatabase } from "../services/database/SqliteDatabase";
import type { EnvironmentSource as EnvironmentSourceType } from "../services/EnvironmentSource";
import type { MutationHistoryRecord } from "../services/history/MutationHistoryTypes";
import type { SecureSnapshotStore } from "../services/history/SecureSnapshotStore";
import type { NileLogger } from "../services/NileLogger";
import type { ConnectionUsageResult } from "../actions/usage/Result";
import type { BindCursorUsageResult } from "../actions/usage/cursor/Binder";
import type { CursorUsageAutoBindResult } from "../application/local/CursorUsageAutoBinder";
import type { AgentStatusView } from "../actions/status/Status";
import type { CreateLocalConnectionInput, RemoveConnectionResult, UpdateConnectionInput } from "./ConnectionTypes";
import { NileSessionRuntime } from "./Runtime";
import { NileSessionEffects } from "./Effects";

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
    const runtime = new NileSessionRuntime({
      databasePath: options.databasePath,
      database: SqliteDatabase.open(options.databasePath),
      credentialStore: options.credentialStore,
      agentHomes: mergeAgentHomes(defaultAgentHomes(), options.agentHomes),
      environment: options.environment,
      secureSnapshotStore: options.secureSnapshotStore,
      logger: options.logger,
      cursorUsageSessionProbe: options.cursorUsageSessionProbe,
    });
    return new NileSession(
      runtime,
      new NileSessionEffects((connectionId) => runtime.autoBindCursorUsage(connectionId), runtime.getLogger()),
    );
  }

  private constructor(
    private readonly runtime: NileSessionRuntime,
    private readonly effects: NileSessionEffects,
  ) {}

  listSavedConnections(): SavedConnectionSummary[] {
    return this.runtime.getSavedConnections().list();
  }

  listSavedConnectionsForAgent(agentId: AgentId): SavedConnectionSummary[] {
    return this.runtime.getSavedConnections().listForAgent(agentId);
  }

  readConnectionCredential(connectionId: string): StoredCredential {
    return this.runtime.getSavedConnections().readCredential(connectionId);
  }

  removeConnection(connectionId: string): RemoveConnectionResult {
    this.runtime.clearConnectionArtifacts(connectionId);
    return this.runtime.getSavedConnections().remove(connectionId);
  }

  async updateConnection(input: UpdateConnectionInput): Promise<SavedConnectionSummary> {
    return await this.runtime.getConnectionWorkflows().update(input, this.runtime.createLocalCredentialResolver());
  }

  useConnection(agentId: AgentId, connectionId: string): ApplyAgentSelectionResult {
    return this.runtime.useConnection(agentId, connectionId);
  }

  getAgentStatus(agentId: AgentId): AgentStatusView {
    return this.runtime.getAgentStatus(agentId);
  }

  listAgentStatuses(agentIds?: AgentId[]): AgentStatusView[] {
    return this.runtime.listAgentStatuses(agentIds);
  }

  scanLocalSetups(agentIds?: AgentId[]): ScanLocalSetupsResult {
    return this.runtime.scanLocalSetups(agentIds);
  }

  importDetectedSetups(input: ImportDetectedSetupsInput): ImportDetectedSetupsResult {
    return this.runtime.importDetectedSetups(input);
  }

  getConnectionUsage(connectionId: string): Promise<ConnectionUsageResult> {
    return this.runtime.getConnectionUsage(connectionId);
  }

  bindCursorUsage(connectionId: string, sessionToken: string): BindCursorUsageResult {
    return this.runtime.bindCursorUsage(connectionId, sessionToken);
  }

  autoBindCursorUsage(connectionId: string): CursorUsageAutoBindResult {
    return this.runtime.autoBindCursorUsage(connectionId);
  }

  autoBindAllCursorUsage(): CursorUsageAutoBindResult[] {
    return this.runtime.autoBindAllCursorUsage();
  }

  async describeConnectionOnboarding(input: CreateConnectionInput): Promise<ConnectionOnboardingSuggestion> {
    return await this.runtime.getConnectionCreator().describeOnboarding(input);
  }

  async createConnection(input: CreateConnectionInput): Promise<CreateConnectionResult> {
    return await this.runtime.getConnectionCreator().create(input);
  }

  async createConnectionWithLocalEffects(input: CreateConnectionInput): Promise<CreateConnectionResult> {
    return await this.effects.applyLocalEffects(this.createConnection(input));
  }

  async createLocalConnection(
    input: CreateLocalConnectionInput,
    localCredentialResolver: LocalCredentialResolver = this.runtime.createLocalCredentialResolver(),
  ): Promise<CreateConnectionResult> {
    return await this.runtime.getConnectionWorkflows().createLocalWithResolver(input, localCredentialResolver);
  }

  async createLocalConnectionWithLocalEffects(
    input: CreateLocalConnectionInput,
    localCredentialResolver: LocalCredentialResolver = this.runtime.createLocalCredentialResolver(),
  ): Promise<CreateConnectionResult> {
    return await this.effects.applyLocalEffects(
      this.createLocalConnection(input, localCredentialResolver),
    );
  }

  async describeLocalConnectionOnboarding(
    input: CreateLocalConnectionInput,
    localCredentialResolver: LocalCredentialResolver = this.runtime.createLocalCredentialResolver(),
  ): Promise<ConnectionOnboardingSuggestion> {
    return await this.runtime.getConnectionWorkflows().describeLocalOnboardingWithResolver(input, localCredentialResolver);
  }

  importCurrentConnection(agentId: AgentId): ImportCurrentConnectionResult {
    return this.runtime.importCurrentConnection(agentId);
  }

  importCurrentConnectionWithLocalEffects(agentId: AgentId): ImportCurrentConnectionResult {
    return this.effects.applyResolvedLocalEffects(this.importCurrentConnection(agentId));
  }

  rollbackLatestMutation(agentId: AgentId): RollbackLatestAgentResult {
    return this.runtime.rollbackLatestMutation(agentId);
  }

  listAgentRollbackSupport(): Array<{ agentId: AgentId; rollback: AgentCapabilitySupport }> {
    return this.runtime.listAgentRollbackSupport();
  }

  getLatestRollbackableMutation(agentId: AgentId, scope?: string): MutationHistoryRecord | null {
    return this.runtime.getLatestRollbackableMutation(agentId, scope);
  }

  listMutationHistory(limit: number = 20, scope?: string): MutationHistoryRecord[] {
    return this.runtime.listMutationHistory(limit, scope);
  }

  close(): void {
    this.runtime.close();
  }
}
