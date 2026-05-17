import { SqliteDatabase } from "../../services/database";
import type { AgentId } from "../agent/Definitions";
import type { AgentConnectionSettingRecord } from "./Types";

type Row = {
  agent_id: string;
  connection_id: string;
  model_id: string;
};

export class SqliteAgentConnectionSettingsStore {
  constructor(private readonly database: SqliteDatabase) {
    this.initialize();
  }

  get(agentId: AgentId, connectionId: string): AgentConnectionSettingRecord | null {
    const row = this.database
      .query<Row, [string, string]>(
        `
          SELECT agent_id, connection_id, model_id
          FROM agent_connection_settings
          WHERE agent_id = ? AND connection_id = ?
        `,
      )
      .get(agentId, connectionId);
    return row ? this.mapRow(row) : null;
  }

  list(): AgentConnectionSettingRecord[] {
    const rows = this.database
      .query<Row, []>(
        `
          SELECT agent_id, connection_id, model_id
          FROM agent_connection_settings
          ORDER BY agent_id ASC, connection_id ASC
        `,
      )
      .all();
    return rows.map((row) => this.mapRow(row));
  }

  set(record: AgentConnectionSettingRecord): void {
    this.database.run(
      `
        INSERT INTO agent_connection_settings (
          agent_id,
          connection_id,
          model_id
        ) VALUES (?, ?, ?)
        ON CONFLICT(agent_id, connection_id) DO UPDATE SET
          model_id = excluded.model_id
      `,
      record.agentId,
      record.connectionId,
      record.modelId,
    );
  }

  clear(agentId: AgentId, connectionId: string): void {
    this.database.run(
      "DELETE FROM agent_connection_settings WHERE agent_id = ? AND connection_id = ?",
      agentId,
      connectionId,
    );
  }

  clearConnection(connectionId: string): void {
    this.database.run(
      "DELETE FROM agent_connection_settings WHERE connection_id = ?",
      connectionId,
    );
  }

  private initialize(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS agent_connection_settings (
        agent_id TEXT NOT NULL,
        connection_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        PRIMARY KEY (agent_id, connection_id)
      );
    `);
  }

  private mapRow(row: Row): AgentConnectionSettingRecord {
    return {
      agentId: row.agent_id as AgentId,
      connectionId: row.connection_id,
      modelId: row.model_id,
    };
  }
}
