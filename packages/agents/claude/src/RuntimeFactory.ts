import type { AgentFactoryRegistration } from "@nile/core/runtime-local/Types";
import { resolveAgentHome } from "@nile/core/models/agent/Homes";
import { ClaudeAgentAdapter } from "./ClaudeAgentAdapter";
import { CLAUDE_AGENT_ID } from "./types";

export const CLAUDE_RUNTIME_FACTORY = {
  agentId: CLAUDE_AGENT_ID,
  create: (input) => new ClaudeAgentAdapter({
    databasePath: input.databasePath,
    claudeHome: resolveAgentHome(CLAUDE_AGENT_ID, input.agentHomes),
    credentialStore: input.credentialStore,
    secureSnapshotStore: input.secureSnapshotStore,
    logger: input.logger?.child({ agent: CLAUDE_AGENT_ID }),
    sharedContext: input.sharedContext,
  }),
} as const satisfies AgentFactoryRegistration;
