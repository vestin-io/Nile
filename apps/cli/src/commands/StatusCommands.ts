import {
  type AgentStatusView,
} from "@nile/core/runtime-local";
import type { CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import type { AgentId } from "@nile/core/models/agent";

import type { ResolvedCliOptions } from "../types";
import { SessionRunner } from "./SessionRunner";

export class StatusCommands {
  private readonly sessions: SessionRunner;

  constructor(
    credentialStore: CredentialStore,
    logger: NileLogger,
  ) {
    this.sessions = new SessionRunner(credentialStore, logger);
  }

  getStatus(options: ResolvedCliOptions, agentId: AgentId): AgentStatusView {
    return this.sessions.run(options, `${agentId}-current-state-detector`, (session) => session.getAgentStatus(agentId));
  }

  getStatuses(options: ResolvedCliOptions, agentIds?: AgentId[]): AgentStatusView[] {
    return this.sessions.run(options, "agent-statuses", (session) => session.listAgentStatuses(agentIds));
  }
}
