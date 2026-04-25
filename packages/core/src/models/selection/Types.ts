import type { AgentId } from "../agent/Types";

export type AgentSelectionRecord = {
  agentId: AgentId;
  connectionId: string;
  endpointId: string;
  accessId: string;
  appliedAt: string;
};
