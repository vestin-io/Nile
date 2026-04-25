import type { AgentSelectionRecord } from "../Types";
import type { AgentId } from "../../agent/Types";

export interface SelectionStore {
  set(record: AgentSelectionRecord): void;
  get(agentId: AgentId): AgentSelectionRecord | null;
  list(): AgentSelectionRecord[];
  clear(agentId: AgentId): void;
}
