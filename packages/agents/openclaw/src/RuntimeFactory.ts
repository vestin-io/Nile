import type { AgentFactoryRegistration } from "@nile/core/runtime-local/Types";
import { resolveAgentHome } from "@nile/core/models/agent";
import { OpenClawAgentAdapter } from "./OpenClawAgentAdapter";
import { OPENCLAW_AGENT_ID } from "./types";

export const OPENCLAW_RUNTIME_FACTORY = {
  agentId: OPENCLAW_AGENT_ID,
  create: (input) => new OpenClawAgentAdapter({
    databasePath: input.databasePath,
    openclawHome: resolveAgentHome(OPENCLAW_AGENT_ID, input.agentHomes),
    credentialStore: input.credentialStore,
    environment: input.environment,
    secureSnapshotStore: input.secureSnapshotStore,
    logger: input.logger?.child({ agent: OPENCLAW_AGENT_ID }),
    sharedContext: input.sharedContext,
  }),
} as const satisfies AgentFactoryRegistration;
