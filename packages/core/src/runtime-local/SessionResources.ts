import type { AgentId } from "../models/agent/Types";
import type { BindCursorUsageResult } from "../actions/usage/cursor/Binder";
import type { CursorUsageAutoBindResult } from "../application/local/CursorUsageAutoBinder";
import type { MutationHistoryRecord } from "../services/history/MutationHistoryTypes";
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

  clearConnectionArtifacts(connectionId: string): void {
    this.workspace.clearConnectionArtifacts(connectionId);
  }
}
