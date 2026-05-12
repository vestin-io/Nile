import type { AgentId } from "../agent/Types";

export type AgentConnectionSettingRecord = {
  agentId: AgentId;
  connectionId: string;
  modelId: string;
};
