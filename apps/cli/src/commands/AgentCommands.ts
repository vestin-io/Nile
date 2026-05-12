import type { AgentId } from "@nile/core/models/agent";
import type { AgentStatusView } from "@nile/core/actions/local-setup";
import type { CredentialStore } from "@nile/core/services/credential";
import type { MutationHistoryRecord } from "@nile/core/services/history";
import { NileLogger } from "@nile/core/services/NileLogger";

import type { ResolvedCliOptions } from "../types";
import { SessionRunner } from "./SessionRunner";

export class AgentCommands {
  private readonly sessions: SessionRunner;

  constructor(
    credentialStore: CredentialStore,
    logger: NileLogger,
  ) {
    this.sessions = new SessionRunner(credentialStore, logger);
  }

  getStatus(options: ResolvedCliOptions, agentId: AgentId): AgentStatusView {
    return this.sessions.run(options, `${agentId}-live-setup-detector`, (session) => session.getAgentStatus(agentId));
  }

  getStatuses(options: ResolvedCliOptions, agentIds?: AgentId[]): AgentStatusView[] {
    return this.sessions.run(options, "agent-statuses", (session) => session.listAgentStatuses(agentIds));
  }

  listHistory(options: ResolvedCliOptions, limit: number = 20): MutationHistoryRecord[] {
    return this.sessions.run(options, "mutation-history", (session) => session.listMutationHistory(limit, "mutation-history"));
  }

  rollbackLatest(
    options: ResolvedCliOptions,
    agentId: AgentId,
  ): { rollbackMutationId: string; rolledBackMutationId: string } {
    return this.sessions.run(options, `${agentId}-rollback-latest`, (session) => {
      const result = session.rollbackLatestMutation(agentId);
      return {
        rollbackMutationId: result.rollbackMutationId,
        rolledBackMutationId: result.rolledBackMutationId,
      };
    });
  }
}
