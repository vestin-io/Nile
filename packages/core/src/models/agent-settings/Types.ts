import type { AgentId } from "../agent/Definitions";

export type AgentConnectionSettingRecord = {
  agentId: AgentId;
  connectionId: string;
  modelId: string;
};
