import { LocalCredentialResolver } from "../application/local/LocalCredentialResolver";
import { EnvironmentSource, type EnvironmentSource as EnvironmentSourceType } from "../services/EnvironmentSource";
import type { NileLogger } from "../services/NileLogger";
import { CodexSessionLogin } from "../agents/codex/CodexSessionLogin";
import type { ConnectionUsageResult } from "../actions/usage/Result";
import type { BindCursorUsageResult } from "../actions/usage/cursor/Binder";
import type { CursorUsageAutoBindResult } from "../application/local/CursorUsageAutoBinder";
import type { ImportDetectedSetupsInput, ImportDetectedSetupsResult, ScanLocalSetupsResult } from "../actions/local-state";
import type { AgentStatusView } from "../actions/local-state";
import type {
  AgentCapabilitySupport,
  ApplyAgentSelectionResult,
  ImportCurrentConnectionResult,
  RollbackLatestAgentResult,
} from "../models/agent";
import type { MutationHistoryRecord } from "../services/history/MutationHistoryTypes";
import type { AgentId } from "../models/agent/Types";
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
    return this.resources.getAgentActions().status.get(agentId);
  }

  listAgentStatuses(agentIds?: AgentId[]): AgentStatusView[] {
    return this.resources.getAgentActions().status.list(agentIds);
  }

  scanLocalSetups(agentIds?: AgentId[]): ScanLocalSetupsResult {
    return this.resources.getAgentActions().scanLocal.run(agentIds);
  }

  importDetectedSetups(input: ImportDetectedSetupsInput): ImportDetectedSetupsResult {
    return this.resources.getAgentActions().importDetectedSetups.run(input);
  }

  importCurrentConnection(agentId: AgentId): ImportCurrentConnectionResult {
    return this.resources.getAgentAdapterRegistry().get(agentId).importCurrentConnection();
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

  bindCursorUsage(connectionId: string, sessionToken: string): BindCursorUsageResult {
    return this.resources.bindCursorUsage(connectionId, sessionToken);
  }

  autoBindCursorUsage(connectionId: string): CursorUsageAutoBindResult {
    return this.resources.autoBindCursorUsage(connectionId);
  }

  autoBindAllCursorUsage(): CursorUsageAutoBindResult[] {
    return this.resources.autoBindAllCursorUsage();
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
