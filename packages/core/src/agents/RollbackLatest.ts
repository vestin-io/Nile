import type { AgentId } from "../models/agent/Definitions";
import type { AgentSelection } from "../models/selection/Selection";
import { MutationHistory } from "../services/history/MutationHistory";
import type { NileLogger } from "../services/NileLogger";

export type RollbackLatestInput = {
  agentId: AgentId;
  startEvent: string;
  successEvent: string;
};

export type RollbackLatestResult = {
  rolledBackMutationId: string;
  rollbackMutationId: string;
};

type AgentStateReconciler = {
  reconcileAgentSelection(): void;
  close(): void;
};

export class RollbackLatest {
  constructor(
    private readonly mutationHistory: MutationHistory,
    private readonly agentSelection: AgentSelection,
    private readonly stateReconciler: AgentStateReconciler,
    private readonly logger: NileLogger,
  ) {}

  execute(input: RollbackLatestInput): RollbackLatestResult {
    this.logger.info(input.startEvent, {});
    const result = this.mutationHistory.rollbackLatest(input.agentId);
    this.agentSelection.clear(input.agentId);
    this.stateReconciler.reconcileAgentSelection();
    this.logger.info(input.successEvent, {
      rollbackMutationId: result.rollbackEntry.id,
      rolledBackMutationId: result.rolledBackEntry.id,
    });

    return {
      rolledBackMutationId: result.rolledBackEntry.id,
      rollbackMutationId: result.rollbackEntry.id,
    };
  }

  close(): void {
    this.mutationHistory.close();
    this.stateReconciler.close();
  }
}
