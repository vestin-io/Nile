import type { AgentId } from "../agent/Definitions";

export type AgentSelectionRecord = {
  agentId: AgentId;
  connectionId: string;
  endpointId: string;
  accessId: string;
  appliedAt: string;
};
