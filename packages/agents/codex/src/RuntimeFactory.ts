import type { AgentFactoryRegistration } from "@nile/core/runtime-local/Types";
import { resolveAgentHome } from "@nile/core/models/agent/Homes";
import { CodexAgentAdapter } from "./CodexAgentAdapter";
import { CODEX_AGENT_ID } from "./types";

export const CODEX_RUNTIME_FACTORY = {
  agentId: CODEX_AGENT_ID,
  create: (input) => new CodexAgentAdapter({
    databasePath: input.databasePath,
    codexHome: resolveAgentHome(CODEX_AGENT_ID, input.agentHomes),
    credentialStore: input.credentialStore,
    environment: input.environment,
    secureSnapshotStore: input.secureSnapshotStore,
    logger: input.logger?.child({ agent: CODEX_AGENT_ID }),
    sharedContext: input.sharedContext,
  }),
} as const satisfies AgentFactoryRegistration;
