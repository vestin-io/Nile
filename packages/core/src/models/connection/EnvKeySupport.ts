import type { AgentId } from "../agent";
import { AGENT_CAPABILITIES } from "../agent";

export class ConnectionEnvKeySupport {
  supportsAgent(agentId: AgentId): boolean {
    return AGENT_CAPABILITIES.read(agentId).supportsManagedEnvBackedApiKey;
  }

  supportsAny(agents: readonly AgentId[]): boolean {
    return agents.some((agentId) => this.supportsAgent(agentId));
  }
}

export const SHARED_CONNECTION_ENV_KEY_SUPPORT = new ConnectionEnvKeySupport();
