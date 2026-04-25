import type { AgentSelection } from "../models/selection/Selection";
import type { SqliteDatabase } from "../services/database/SqliteDatabase";
import type { SharedAgentAdapterContext } from "../runtime-local/AgentAdapterContext";

export interface WorkspaceState {
  readonly databasePath: string;
  readonly database: SqliteDatabase;
  createSharedAgentAdapterContext(agentSelection: AgentSelection): SharedAgentAdapterContext;
  close(): void;
}
