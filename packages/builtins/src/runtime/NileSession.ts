import { LocalCredentialResolver } from "@nile/core/application/local/LocalCredentialResolver";
import type {
  CreateLocalConnectionInput,
  RemoveConnectionResult,
  UpdateConnectionInput,
} from "@nile/core/application/local/ConnectionInputs";
import type {
  ImportDetectedSetupsInput,
  ImportDetectedSetupsResult,
  ScanLocalSetupsResult,
} from "@nile/core/actions/local-setup";
import type {
  AgentCapabilitySupport,
  AgentRuntimeCommandOverrides,
  ApplyAgentSelectionResult,
  ImportCurrentConnectionInput,
  ImportCurrentConnectionResult,
  RollbackLatestAgentResult,
} from "@nile/core/models/agent";
import type { AgentHomes } from "@nile/core/models/agent/Homes";
import { defaultAgentHomes, mergeAgentHomes } from "@nile/core/models/agent/Homes";
import type { AgentId } from "@nile/core/models/agent";
import type { SavedConnectionSummary } from "@nile/core/models/connection/SavedConnections";
import type {
  ConnectionModelCatalogResult,
  ConnectionOnboardingSuggestion,
  CreateConnectionInput,
  CreateConnectionResult,
} from "@nile/core/models/connection/Runtime";
import type { CredentialStore } from "@nile/core/services/credential/Store";
import type { StoredCredential } from "@nile/core/services/credential/Types";
import { SqliteDatabase } from "@nile/core/services/database/SqliteDatabase";
import {
  EnvironmentSource,
  type EnvironmentSource as EnvironmentSourceType,
} from "@nile/core/services/EnvironmentSource";
import type { MutationHistoryRecord } from "@nile/core/services/history/MutationHistoryTypes";
import type { SecureSnapshotStore } from "@nile/core/services/history/SecureSnapshotStore";
import type { NileLogger } from "@nile/core/services/NileLogger";
import type { ConnectionUsageResult } from "@nile/core/actions/usage/Result";
import type { AgentStatusView } from "@nile/core/actions/local-setup";
import type { MatchedImportStateSnapshot } from "@nile/core/runtime-local/import-state";
import type { SessionRuntimeOptions } from "./Types";
import { SessionResources } from "./SessionResources";

export type NileSessionOpenOptions = {
  databasePath: string;
  credentialStore: CredentialStore;
  environment?: EnvironmentSourceType;
  openExternalUrl?: (url: string) => Promise<void>;
  secureSnapshotStore?: SecureSnapshotStore;
  logger?: NileLogger;
  agentHomes?: AgentHomes;
  agentRuntimeCommandOverrides?: AgentRuntimeCommandOverrides;
};

export class NileSession {
  static open(options: NileSessionOpenOptions): NileSession {
    const database = SqliteDatabase.open(options.databasePath);
    const runtimeOptions: SessionRuntimeOptions = {
      databasePath: options.databasePath,
      database,
      credentialStore: options.credentialStore,
      agentHomes: mergeAgentHomes(defaultAgentHomes(), options.agentHomes),
      agentRuntimeCommandOverrides: options.agentRuntimeCommandOverrides,
      environment: options.environment,
      openExternalUrl: options.openExternalUrl,
      secureSnapshotStore: options.secureSnapshotStore,
      logger: options.logger,
    };
    const createLocalCredentialResolver = () =>
      new LocalCredentialResolver(
        runtimeOptions.agentHomes,
        runtimeOptions.environment ?? EnvironmentSource.empty(),
        undefined,
        runtimeOptions.openExternalUrl,
        runtimeOptions.agentRuntimeCommandOverrides,
      );
    const resources = new SessionResources(runtimeOptions, createLocalCredentialResolver);
    return new NileSession(resources, createLocalCredentialResolver, () => database.close());
  }

  private constructor(
    private readonly resources: SessionResources,
    private readonly createLocalCredentialResolver: () => LocalCredentialResolver,
    private readonly closeDatabase: () => void,
  ) {}

  listSavedConnections(): SavedConnectionSummary[] {
    return this.resources.getSavedConnections().list();
  }

  listSavedConnectionsForAgent(agentId: AgentId): SavedConnectionSummary[] {
    return this.resources.getSavedConnections().listForAgent(agentId);
  }

  readConnectionCredential(connectionId: string): StoredCredential {
    return this.resources.getSavedConnections().readCredential(connectionId);
  }

  syncConnectionCredential(connectionId: string, credential: StoredCredential): SavedConnectionSummary {
    return this.resources.getSavedConnections().syncCredential(connectionId, credential);
  }

  setConnectionDirectApiKeyEnvKey(connectionId: string, envKey: string | null): SavedConnectionSummary {
    return this.resources.getSavedConnections().setDirectApiKeyEnvKey(connectionId, envKey);
  }

  removeConnection(connectionId: string): RemoveConnectionResult {
    this.resources.clearConnectionArtifacts(connectionId);
    return this.resources.getSavedConnections().remove(connectionId);
  }

  async updateConnection(input: UpdateConnectionInput): Promise<SavedConnectionSummary> {
    return await this.resources.getLocalConnectionWorkflows().update(input, this.createLocalCredentialResolver());
  }

  useConnection(agentId: AgentId, connectionId: string): ApplyAgentSelectionResult {
    return this.resources.getAgentAdapterRegistry().get(agentId).applySelection(connectionId);
  }

  getAgentStatus(agentId: AgentId): AgentStatusView {
    const detections = this.resources.getAgentActions().selectionSync.run([agentId]);
    return this.resources.getAgentActions().status.get(agentId, detections.get(agentId));
  }

  listAgentStatuses(agentIds?: AgentId[]): AgentStatusView[] {
    const detections = this.resources.getAgentActions().selectionSync.run(agentIds);
    return this.resources.getAgentActions().status.list(agentIds, detections);
  }

  scanLocalSetups(agentIds?: AgentId[]): ScanLocalSetupsResult {
    const detections = this.resources.getAgentActions().selectionSync.run(agentIds);
    return this.resources.getAgentActions().scanLocal.run(agentIds, detections);
  }

  async importDetectedSetups(input: ImportDetectedSetupsInput): Promise<ImportDetectedSetupsResult> {
    return await this.resources.getAgentActions().importDetectedSetups.run(input);
  }

  getConnectionUsage(
    connectionId: string,
    options?: { recoverUnauthorizedCurrentSession?: boolean },
  ): Promise<ConnectionUsageResult> {
    return this.resources.getUsage().get(connectionId, options);
  }

  getConnectionModelCatalog(connectionId: string): Promise<ConnectionModelCatalogResult> {
    return this.resources.getConnectionModelCatalog(connectionId);
  }

  getAgentConnectionModel(agentId: AgentId, connectionId: string): string | null {
    return this.resources.getAgentConnectionModel(agentId, connectionId);
  }

  setAgentConnectionModel(agentId: AgentId, connectionId: string, modelId: string | null): string | null {
    return this.resources.setAgentConnectionModel(agentId, connectionId, modelId);
  }

  captureMatchedImportState(agentId: AgentId, connectionId: string): MatchedImportStateSnapshot {
    return this.resources.captureMatchedImportState(agentId, connectionId);
  }

  restoreMatchedImportState(snapshot: MatchedImportStateSnapshot): void {
    this.resources.restoreMatchedImportState(snapshot);
  }

  async describeConnectionOnboarding(input: CreateConnectionInput): Promise<ConnectionOnboardingSuggestion> {
    return await this.resources.getConnectionCreator().describeOnboarding(input);
  }

  async createConnection(input: CreateConnectionInput): Promise<CreateConnectionResult> {
    return await this.resources.getConnectionCreator().create(input);
  }

  async createLocalConnection(
    input: CreateLocalConnectionInput,
    localCredentialResolver: LocalCredentialResolver = this.createLocalCredentialResolver(),
  ): Promise<CreateConnectionResult> {
    return await this.resources.getLocalConnectionWorkflows().createLocalWithResolver(input, localCredentialResolver);
  }

  async describeLocalConnectionOnboarding(
    input: CreateLocalConnectionInput,
    localCredentialResolver: LocalCredentialResolver = this.createLocalCredentialResolver(),
  ): Promise<ConnectionOnboardingSuggestion> {
    return await this.resources.getLocalConnectionWorkflows().describeLocalOnboardingWithResolver(
      input,
      localCredentialResolver,
    );
  }

  async importCurrentConnection(
    agentId: AgentId,
    input?: ImportCurrentConnectionInput,
  ): Promise<ImportCurrentConnectionResult> {
    return await this.resources.getAgentAdapterRegistry().get(agentId).importCurrentConnection(input);
  }

  rollbackLatestMutation(agentId: AgentId): RollbackLatestAgentResult {
    return this.resources.getAgentAdapterRegistry().get(agentId).rollbackLatestMutation();
  }

  listAgentRollbackSupport(): Array<{ agentId: AgentId; rollback: AgentCapabilitySupport }> {
    return this.resources.getAgentAdapterRegistry().listRollbackSupport();
  }

  getLatestRollbackableMutation(agentId: AgentId, scope?: string): MutationHistoryRecord | null {
    return this.resources.getLatestRollbackableMutation(agentId, scope);
  }

  listMutationHistory(limit: number = 20, scope?: string): MutationHistoryRecord[] {
    return this.resources.listMutationHistory(limit, scope);
  }

  close(): void {
    this.closeDatabase();
  }
}
