import { LocalCredentialResolver } from "../application/local/LocalCredentialResolver";
import type { CursorUsageSessionProbe } from "../application/local/CursorUsageSessionProbe";
import {
  type ImportDetectedSetupsInput,
  type ImportDetectedSetupsResult,
  type ScanLocalSetupsResult,
} from "../actions/scan-local";
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
      new NileSessionEffects(() => runtime.getUsageAccess(), runtime.getLogger()),
    );
  }

  private constructor(
    private readonly runtime: NileSessionRuntime,
    private readonly effects: NileSessionEffects,
  ) {}

  listSavedConnections(): SavedConnectionSummary[] {
    return this.runtime.getConnections().list();
  }

  listSavedConnectionsForAgent(agentId: AgentId): SavedConnectionSummary[] {
    return this.runtime.getConnections().listForAgent(agentId);
  }

  readConnectionCredential(connectionId: string): StoredCredential {
    return this.runtime.getConnections().readCredential(connectionId);
  }

  removeConnection(connectionId: string): RemoveConnectionResult {
    this.runtime.getUsageAccess().clearConnectionArtifacts(connectionId);
    return this.runtime.getConnections().remove(connectionId);
  }

  async updateConnection(input: UpdateConnectionInput): Promise<SavedConnectionSummary> {
    return await this.runtime.getConnections().update(input, this.runtime.createLocalCredentialResolver());
  }

  useConnection(agentId: AgentId, connectionId: string): ApplyAgentSelectionResult {
    return this.runtime.getAgents().useConnection(agentId, connectionId);
  }

  getAgentStatus(agentId: AgentId): AgentStatusView {
    return this.runtime.getAgents().getStatus(agentId);
  }

  listAgentStatuses(agentIds?: AgentId[]): AgentStatusView[] {
    return this.runtime.getAgents().listStatuses(agentIds);
  }

  scanLocalSetups(agentIds?: AgentId[]): ScanLocalSetupsResult {
    return this.runtime.getAgents().scanLocalSetups(agentIds);
  }

  importDetectedSetups(input: ImportDetectedSetupsInput): ImportDetectedSetupsResult {
    return this.runtime.getAgents().importDetected(input);
  }

  getConnectionUsage(connectionId: string): Promise<ConnectionUsageResult> {
    return this.runtime.getUsageAccess().getConnectionUsage(connectionId);
  }

  bindCursorUsage(connectionId: string, sessionToken: string): BindCursorUsageResult {
    return this.runtime.getUsageAccess().bindCursorUsage(connectionId, sessionToken);
  }

  autoBindCursorUsage(connectionId: string): CursorUsageAutoBindResult {
    return this.runtime.getUsageAccess().autoBindCursorUsage(connectionId);
  }

  autoBindAllCursorUsage(): CursorUsageAutoBindResult[] {
    return this.runtime.getUsageAccess().autoBindAllCursorUsage();
  }

  async describeConnectionOnboarding(input: CreateConnectionInput): Promise<ConnectionOnboardingSuggestion> {
    return await this.runtime.getConnections().describeOnboarding(input);
  }

  async createConnection(input: CreateConnectionInput): Promise<CreateConnectionResult> {
    return await this.runtime.getConnections().create(input);
  }

  async createConnectionWithLocalEffects(input: CreateConnectionInput): Promise<CreateConnectionResult> {
    return await this.effects.applyLocalEffects(this.createConnection(input));
  }

  async createLocalConnection(
    input: CreateLocalConnectionInput,
    localCredentialResolver: LocalCredentialResolver = this.runtime.createLocalCredentialResolver(),
  ): Promise<CreateConnectionResult> {
    return await this.runtime.getConnections().createLocalWithResolver(input, localCredentialResolver);
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
    return await this.runtime.getConnections().describeLocalOnboardingWithResolver(input, localCredentialResolver);
  }

  importCurrentConnection(agentId: AgentId): ImportCurrentConnectionResult {
    return this.runtime.getAgents().importCurrentConnection(agentId);
  }

  importCurrentConnectionWithLocalEffects(agentId: AgentId): ImportCurrentConnectionResult {
    return this.effects.applyResolvedLocalEffects(this.importCurrentConnection(agentId));
  }

  rollbackLatestMutation(agentId: AgentId): RollbackLatestAgentResult {
    return this.runtime.getAgents().rollbackLatestMutation(agentId);
  }

  listAgentCapabilities(): Array<{ agentId: AgentId; capabilities: AgentAdapterCapabilities }> {
    return this.runtime.getAgents().listCapabilities();
  }

  getLatestRollbackableMutation(agentId: AgentId, scope?: string): MutationHistoryRecord | null {
    return this.runtime.getAgents().getLatestRollbackableMutation(agentId, scope);
  }

  listMutationHistory(limit: number = 20, scope?: string): MutationHistoryRecord[] {
    return this.runtime.getAgents().listMutationHistory(limit, scope);
  }

  close(): void {
    this.runtime.close();
  }
}
