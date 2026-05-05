import type { AccessRegistry } from "../../models/access";
import type { EndpointRegistry } from "../../models/endpoint";
import { AgentSelection } from "../../models/selection/Selection";
import { SqliteDatabase } from "../../services/database/SqliteDatabase";

export type SharedAgentAdapterContext = {
  databasePath: string;
  database: SqliteDatabase;
  endpointRegistry: EndpointRegistry;
  accessRegistry: AccessRegistry;
  agentSelection: AgentSelection;
};
