import type { AgentFactoryRegistration } from "@nile/core/runtime-local/Types";
import { resolveAgentHome } from "@nile/core/models/agent";
import { CursorAgentAdapter } from "./CursorAgentAdapter";
import { CURSOR_AGENT_ID } from "./types";

export const CURSOR_RUNTIME_FACTORY = {
  agentId: CURSOR_AGENT_ID,
  create: (input) => new CursorAgentAdapter({
    databasePath: input.databasePath,
    cursorHome: resolveAgentHome(CURSOR_AGENT_ID, input.agentHomes),
    credentialStore: input.credentialStore,
    environment: input.environment,
    secureSnapshotStore: input.secureSnapshotStore,
    logger: input.logger?.child({ agent: CURSOR_AGENT_ID }),
    sharedContext: input.sharedContext,
  }),
} as const satisfies AgentFactoryRegistration;
