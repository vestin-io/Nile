import type { PreparedAgentApplySelection } from "../actions/use/ApplySupport";
import { AgentApplySupport } from "../actions/use/ApplySupport";
import type { AgentId } from "../models/agent/Types";
import type { ApplyAgentSelectionResult } from "../runtime-local/AgentAdapterTypes";
import { MutationHistory } from "../services/history/MutationHistory";
import type {
  MutationAfterFileInput,
  MutationTrackedFileInput,
} from "../services/history/MutationHistoryTypes";
import type { NileLogger } from "../services/NileLogger";

export type ApplyMutationInput = {
  agentId: AgentId;
  connectionId: string;
  historyMarkFailedEvent: string;
  buildFiles: (prepared: PreparedAgentApplySelection) => MutationTrackedFileInput[];
  apply: (prepared: PreparedAgentApplySelection) => void;
  readAppliedFiles: () => MutationAfterFileInput[];
  restore: () => void;
};

export class ApplyMutation {
  constructor(
    private readonly mutationHistory: MutationHistory,
    private readonly applySupport: AgentApplySupport,
    private readonly logger: NileLogger,
  ) {}

  execute(input: ApplyMutationInput): ApplyAgentSelectionResult {
    const prepared = this.applySupport.prepare(input.connectionId);
    const mutation = this.mutationHistory.start({
      agentId: input.agentId,
      type: "apply_selection",
      connectionId: prepared.connectionId,
      connectionLabel: prepared.access.label,
      endpointLabel: prepared.endpoint.label,
      accessLabel: prepared.access.label,
      files: input.buildFiles(prepared),
    });

    try {
      input.apply(prepared);
      this.mutationHistory.markApplied(mutation.id, input.readAppliedFiles());
    } catch (error) {
      input.restore();
      try {
        this.mutationHistory.markFailed(
          mutation.id,
          error instanceof Error ? error.message : String(error),
        );
      } catch (historyError) {
        this.logger.error(input.historyMarkFailedEvent, historyError, {
          mutationId: mutation.id,
        });
      }
      this.applySupport.logRollback(error, prepared);
      throw error;
    }

    return this.applySupport.complete(prepared);
  }

  close(): void {
    this.mutationHistory.close();
  }
}
