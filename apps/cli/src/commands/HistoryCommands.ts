import {
  type MutationHistoryRecord,
} from "@nile/core/services/history";
import type { CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import type { AgentId } from "@nile/core/models/agent";

import type { ResolvedCliOptions } from "../types";
import { SessionRunner } from "./SessionRunner";

export class HistoryCommands {
  private readonly sessions: SessionRunner;

  constructor(
    credentialStore: CredentialStore,
    logger: NileLogger,
  ) {
    this.sessions = new SessionRunner(credentialStore, logger);
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
