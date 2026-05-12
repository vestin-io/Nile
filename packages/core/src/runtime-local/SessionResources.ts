import type { AgentId } from "../models/agent/Types";
import type { BindCursorUsageResult } from "../actions/usage/cursor/Binder";
import type { CursorUsageAutoBindResult } from "../application/local/CursorUsageAutoBinder";
import type { MutationHistoryRecord } from "../services/history/MutationHistoryTypes";
import type { MatchedImportStateSnapshot } from "./ImportState";
import { BuiltInAgentAdapters } from "./BuiltInAdapters";
import { AgentAdapterRegistry } from "./AgentAdapterRegistry";
import { SessionHistoryResources } from "./SessionHistoryResources";
import type { SessionRuntimeOptions } from "./SessionRuntimeOptions";
import { SessionWorkspaceResources } from "./SessionWorkspaceResources";

export class SessionResources {
  private adapterRegistry: AgentAdapterRegistry | null = null;
  private readonly workspace: SessionWorkspaceResources;
  private readonly history: SessionHistoryResources;

  constructor(
    private readonly options: SessionRuntimeOptions,
    createLocalCredentialResolver: () => import("../application/local/LocalCredentialResolver").LocalCredentialResolver,
  ) {
    this.workspace = new SessionWorkspaceResources(options, createLocalCredentialResolver);
    this.history = new SessionHistoryResources(options);
  }

  getSavedConnections() {
    return this.workspace.getSavedConnections();
  }

  getConnectionCreator() {
    return this.workspace.getConnectionCreator();
  }

  getLocalConnectionWorkflows() {
    return this.workspace.getLocalConnectionWorkflows();
  }

  getAgentAdapterRegistry(): AgentAdapterRegistry {
    return (this.adapterRegistry ??= AgentAdapterRegistry.fromAdapters(
      BuiltInAgentAdapters.fromSharedContext(
        this.workspace.createAgentWorkspaceContext(),
        {
          credentialStore: this.options.credentialStore,
          environment: this.options.environment,
          secureSnapshotStore: this.options.secureSnapshotStore,
          logger: this.options.logger,
          agentHomes: this.options.agentHomes,
        },
      ),
    ));
  }

  getAgentActions() {
    return this.workspace.getAgentActions(this.getAgentAdapterRegistry());
  }

  getUsage() {
    return this.workspace.getUsage();
  }

  getConnectionModelCatalog(connectionId: string) {
    return this.workspace.getConnectionModelCatalog(connectionId);
  }

  getLatestRollbackableMutation(agentId: AgentId, scope?: string): MutationHistoryRecord | null {
    return this.history.getLatestRollbackableMutation(agentId, scope);
  }

  listMutationHistory(limit: number, scope?: string): MutationHistoryRecord[] {
    return this.history.listMutationHistory(limit, scope);
  }

  bindCursorUsage(connectionId: string, sessionToken: string): BindCursorUsageResult {
    return this.workspace.bindCursorUsage(connectionId, sessionToken);
  }

  autoBindCursorUsage(connectionId: string): CursorUsageAutoBindResult {
    return this.workspace.autoBindCursorUsage(connectionId);
  }

  autoBindAllCursorUsage(): CursorUsageAutoBindResult[] {
    return this.workspace.autoBindAllCursorUsage();
  }

  getAgentConnectionModel(agentId: AgentId, connectionId: string): string | null {
    return this.workspace.getAgentConnectionModel(agentId, connectionId);
  }

  setAgentConnectionModel(agentId: AgentId, connectionId: string, modelId: string | null): string | null {
    return this.workspace.setAgentConnectionModel(agentId, connectionId, modelId);
  }

  clearConnectionArtifacts(connectionId: string): void {
    this.workspace.clearConnectionArtifacts(connectionId);
  }

  captureMatchedImportState(agentId: AgentId, connectionId: string): MatchedImportStateSnapshot {
    return this.workspace.captureMatchedImportState(agentId, connectionId);
  }

  restoreMatchedImportState(snapshot: MatchedImportStateSnapshot): void {
    this.workspace.restoreMatchedImportState(snapshot);
  }
}
