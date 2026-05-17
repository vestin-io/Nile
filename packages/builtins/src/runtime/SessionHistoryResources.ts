import type { AgentId } from "@nile/core/models/agent/Definitions";
import { MutationHistory } from "@nile/core/services/history/MutationHistory";
import type { MutationHistoryRecord } from "@nile/core/services/history/MutationHistoryTypes";
import type { SessionRuntimeOptions } from "./Types";

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
