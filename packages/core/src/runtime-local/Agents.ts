import type { ImportDetectedSetupsInput, ImportDetectedSetupsResult, ScanLocalSetupsResult } from "../actions/scan-local/Result";
import type { AgentStatusView } from "../actions/status/Status";
import type { MutationHistory } from "../services/history/MutationHistory";
import type { MutationHistoryRecord } from "../services/history/MutationHistoryTypes";
import type { AgentId } from "../models/agent/Types";
import type {
  AgentAdapterCapabilities,
  ApplyAgentSelectionResult,
  ImportCurrentConnectionResult,
  RollbackLatestAgentResult,
} from "./AgentAdapterTypes";
import type { AgentAdapterRegistry } from "./AgentAdapterRegistry";
import type { ImportDetectedSetups } from "../actions/scan-local/ImportDetectedSetups";
import type { ScanLocalSetups } from "../actions/scan-local/ScanLocalSetups";
import type { Status } from "../actions/status/Status";

export class SessionAgents {
  constructor(
    private readonly adapterRegistry: AgentAdapterRegistry,
    private readonly status: Status,
    private readonly scanLocal: ScanLocalSetups,
    private readonly importDetectedSetups: ImportDetectedSetups,
    private readonly getMutationHistory: (scope?: string) => MutationHistory,
  ) {}

  useConnection(agentId: AgentId, connectionId: string): ApplyAgentSelectionResult {
    return this.adapterRegistry.get(agentId).applySelection(connectionId);
  }

  getStatus(agentId: AgentId): AgentStatusView {
    return this.status.get(agentId);
  }

  listStatuses(agentIds?: AgentId[]): AgentStatusView[] {
    return this.status.list(agentIds);
  }

  scanLocalSetups(agentIds?: AgentId[]): ScanLocalSetupsResult {
    return this.scanLocal.run(agentIds);
  }

  importDetected(input: ImportDetectedSetupsInput): ImportDetectedSetupsResult {
    return this.importDetectedSetups.run(input);
  }

  importCurrentConnection(agentId: AgentId): ImportCurrentConnectionResult {
    return this.adapterRegistry.get(agentId).importCurrentConnection();
  }

  rollbackLatestMutation(agentId: AgentId): RollbackLatestAgentResult {
    return this.adapterRegistry.get(agentId).rollbackLatestMutation();
  }

  listCapabilities(): Array<{ agentId: AgentId; capabilities: AgentAdapterCapabilities }> {
    return this.adapterRegistry.listCapabilities();
  }

  getLatestRollbackableMutation(agentId: AgentId, scope?: string): MutationHistoryRecord | null {
    return this.getMutationHistory(scope).findLatestRollbackCandidate(agentId);
  }

  listMutationHistory(limit: number = 20, scope?: string): MutationHistoryRecord[] {
    return this.getMutationHistory(scope).list(limit);
  }
}
