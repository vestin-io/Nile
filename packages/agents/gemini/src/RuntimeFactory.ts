import type { AgentFactoryRegistration } from "@nile/core/runtime-local/Types";
import { resolveAgentHome } from "@nile/core/models/agent/Homes";
import { GeminiAgentAdapter } from "./GeminiAgentAdapter";
import { GEMINI_AGENT_ID } from "./types";

export const GEMINI_RUNTIME_FACTORY = {
  agentId: GEMINI_AGENT_ID,
  create: (input) => new GeminiAgentAdapter({
    databasePath: input.databasePath,
    geminiHome: resolveAgentHome(GEMINI_AGENT_ID, input.agentHomes),
    credentialStore: input.credentialStore,
    secureSnapshotStore: input.secureSnapshotStore,
    logger: input.logger?.child({ agent: GEMINI_AGENT_ID }),
    sharedContext: input.sharedContext,
  }),
} as const satisfies AgentFactoryRegistration;
