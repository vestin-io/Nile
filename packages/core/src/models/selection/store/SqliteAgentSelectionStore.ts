import { SqliteDatabase } from "../../../services/database/SqliteDatabase";
import { type AgentSelectionRecord } from "../Types";
import type { AgentId } from "../../agent/Types";
import type { SelectionStore } from "./SelectionStore";

type AgentSelectionRow = {
  agent_id: string;
  connection_id: string;
  endpoint_id: string;
  access_id: string;
  applied_at: string;
};

export class SqliteAgentSelectionStore implements SelectionStore {
  constructor(private readonly database: SqliteDatabase) {
    this.initialize();
  }

  set(record: AgentSelectionRecord): void {
    this.database.run(
      `
        INSERT INTO agent_selections (
          agent_id,
          connection_id,
          endpoint_id,
          access_id,
          applied_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(agent_id) DO UPDATE SET
          connection_id = excluded.connection_id,
          endpoint_id = excluded.endpoint_id,
          access_id = excluded.access_id,
          applied_at = excluded.applied_at
      `,
      record.agentId,
      record.connectionId,
      record.endpointId,
      record.accessId,
      record.appliedAt,
    );
  }

  get(agentId: AgentId): AgentSelectionRecord | null {
    const row = this.database
      .query<AgentSelectionRow, [string]>(
        `
          SELECT
            agent_id,
            connection_id,
            endpoint_id,
            access_id,
            applied_at
          FROM agent_selections
          WHERE agent_id = ?
        `,
      )
      .get(agentId);

    return row ? this.mapRow(row) : null;
  }

  list(): AgentSelectionRecord[] {
    return this.database
      .query<AgentSelectionRow, []>(
        `
          SELECT
            agent_id,
            connection_id,
            endpoint_id,
            access_id,
            applied_at
          FROM agent_selections
          ORDER BY agent_id ASC
        `,
      )
      .all()
      .map((row) => this.mapRow(row));
  }

  clear(agentId: AgentId): void {
    this.database.run("DELETE FROM agent_selections WHERE agent_id = ?", agentId);
  }

  private initialize(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS agent_selections (
        agent_id TEXT PRIMARY KEY,
        connection_id TEXT NOT NULL,
        endpoint_id TEXT NOT NULL,
        access_id TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
  }

  private mapRow(row: AgentSelectionRow): AgentSelectionRecord {
    return {
      agentId: row.agent_id as AgentId,
      connectionId: row.connection_id,
      endpointId: row.endpoint_id,
      accessId: row.access_id,
      appliedAt: row.applied_at,
    };
  }
}
