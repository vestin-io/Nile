import type { AgentId } from "../models/agent/Types";
import { MutationHistory } from "../services/history/MutationHistory";
import type { MutationHistoryRecord } from "../services/history/MutationHistoryTypes";
import type { SessionRuntimeOptions } from "./SessionRuntimeOptions";

export class SessionHistoryResources {
  private history: MutationHistory | null = null;

  constructor(private readonly options: SessionRuntimeOptions) {}

  getLatestRollbackableMutation(agentId: AgentId, scope?: string): MutationHistoryRecord | null {
    return this.getMutationHistory(scope).findLatestRollbackCandidate(agentId);
  }

  listMutationHistory(limit: number, scope?: string): MutationHistoryRecord[] {
    return this.getMutationHistory(scope).list(limit);
  }

  private getMutationHistory(scope?: string): MutationHistory {
    if (!scope) {
      return (this.history ??= this.createMutationHistory("mutation-history"));
    }
    return this.createMutationHistory(scope);
  }

  private createMutationHistory(scope?: string): MutationHistory {
    return MutationHistory.fromDatabase(this.options.databasePath, this.options.database, {
      secureSnapshotStore: this.options.secureSnapshotStore,
      logger: scope ? this.options.logger?.child({ scope }) : this.options.logger,
    });
  }
}
