import { formatAgentLabel, SUPPORTED_AGENT_IDS } from "@nile/core/models/agent/types";
import type { NileSession } from "@nile/core/runtime-local";

import type { DesktopHistoryAgentState, DesktopHistoryEntry, HistoryState } from "./Types";

export class DesktopHistoryStateQuery {
  read(session: NileSession): HistoryState {
    const rollbackByAgent = new Map(
      session.listAgentRollbackSupport().map((entry) => [entry.agentId, entry.rollback]),
    );
    const entries = session.listMutationHistory(20).map<DesktopHistoryEntry>((entry) => ({
      id: entry.id,
      agentId: entry.agentId,
      agentLabel: formatAgentLabel(entry.agentId),
      type: entry.type,
      status: entry.status,
      connectionId: entry.connectionId,
      connectionLabel: entry.connectionLabel,
      endpointLabel: entry.endpointLabel,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt,
      errorMessage: entry.errorMessage,
      fileCount: entry.files.length,
    }));

    return {
      agents: SUPPORTED_AGENT_IDS.map<DesktopHistoryAgentState>((agentId) => ({
        agentId,
        agentLabel: formatAgentLabel(agentId),
        canRollback: rollbackByAgent.get(agentId) === "yes",
        latestRollbackableMutationId: session.getLatestRollbackableMutation(agentId, "history-state")?.id ?? null,
      })),
      entries,
    };
  }
}
