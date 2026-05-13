import { LocalCredentialResolver } from "../application/local/LocalCredentialResolver";
import { EnvironmentSource, type EnvironmentSource as EnvironmentSourceType } from "../services/EnvironmentSource";
import type { NileLogger } from "../services/NileLogger";
import { CodexSessionLogin } from "../agents/codex/CodexSessionLogin";
import type { ConnectionUsageResult } from "../actions/usage/Result";
import type { BindCursorUsageResult } from "../actions/usage/cursor/Binder";
import type { CursorUsageAutoBindResult } from "../application/local/CursorUsageAutoBinder";
import type { ImportDetectedSetupsInput, ImportDetectedSetupsResult, ScanLocalSetupsResult } from "../actions/local-setup";
import type { AgentStatusView } from "../actions/local-setup";
import type {
  AgentCapabilitySupport,
  ApplyAgentSelectionResult,
  ImportCurrentConnectionResult,
  RollbackLatestAgentResult,
} from "../models/agent";
import type { MutationHistoryRecord } from "../services/history/MutationHistoryTypes";
import type { AgentId } from "../models/agent/Types";
import type { MatchedImportStateSnapshot } from "./ImportState";
import { SessionResources } from "./SessionResources";
import type { SessionRuntimeOptions } from "./SessionRuntimeOptions";

export class SessionRuntime {
  private readonly resources: SessionResources;

  constructor(private readonly options: SessionRuntimeOptions) {
    this.resources = new SessionResources(options, () => this.createLocalCredentialResolver());
  }

  getSavedConnections() {
    return this.resources.getSavedConnections();
  }

  setConnectionDirectApiKeyEnvKey(connectionId: string, envKey: string | null) {
    return this.resources.getSavedConnections().setDirectApiKeyEnvKey(connectionId, envKey);
  }

  getConnectionCreator() {
    return this.resources.getConnectionCreator();
  }

  getLocalConnectionWorkflows() {
    return this.resources.getLocalConnectionWorkflows();
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
    return this.resources.getAgentActions().status.list(
      agentIds,
      detections,
    );
  }

  scanLocalSetups(agentIds?: AgentId[]): ScanLocalSetupsResult {
    const detections = this.resources.getAgentActions().selectionSync.run(agentIds);
    return this.resources.getAgentActions().scanLocal.run(agentIds, detections);
  }

  async importDetectedSetups(input: ImportDetectedSetupsInput): Promise<ImportDetectedSetupsResult> {
    return await this.resources.getAgentActions().importDetectedSetups.run(input);
  }

  async importCurrentConnection(agentId: AgentId): Promise<ImportCurrentConnectionResult> {
    return await this.resources.getAgentAdapterRegistry().get(agentId).importCurrentConnection();
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

  getConnectionUsage(connectionId: string): Promise<ConnectionUsageResult> {
    return this.resources.getUsage().get(connectionId);
  }

  getConnectionModelCatalog(connectionId: string) {
    return this.resources.getConnectionModelCatalog(connectionId);
  }

  bindCursorUsage(connectionId: string, sessionToken: string): BindCursorUsageResult {
    return this.resources.bindCursorUsage(connectionId, sessionToken);
  }

  autoBindCursorUsage(connectionId: string): CursorUsageAutoBindResult {
    return this.resources.autoBindCursorUsage(connectionId);
  }

  autoBindAllCursorUsage(): CursorUsageAutoBindResult[] {
    return this.resources.autoBindAllCursorUsage();
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

  clearConnectionArtifacts(connectionId: string): void {
    this.resources.clearConnectionArtifacts(connectionId);
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
}
