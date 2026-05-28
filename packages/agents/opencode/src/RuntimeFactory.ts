import type { AgentFactoryRegistration } from "@nile/core/runtime-local/Types";
import { resolveAgentHome } from "@nile/core/models/agent/Homes";
import { OpenCodeAgentAdapter } from "./OpenCodeAgentAdapter";
import { OPENCODE_AGENT_ID } from "./types";

export const OPENCODE_RUNTIME_FACTORY = {
  agentId: OPENCODE_AGENT_ID,
  create: (input) => new OpenCodeAgentAdapter({
    databasePath: input.databasePath,
    opencodeHome: resolveAgentHome(OPENCODE_AGENT_ID, input.agentHomes),
    credentialStore: input.credentialStore,
    environment: input.environment,
    secureSnapshotStore: input.secureSnapshotStore,
    logger: input.logger?.child({ agent: OPENCODE_AGENT_ID }),
    sharedContext: input.sharedContext,
  }),
} as const satisfies AgentFactoryRegistration;
