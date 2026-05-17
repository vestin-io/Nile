import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import type { AgentId } from "../agent/Definitions";
import { SqliteAgentConnectionSettingsStore } from "./SqliteStore";
import type { AgentConnectionSettingRecord } from "./Types";

export class AgentConnectionSettings {
  static open(databasePath: string): AgentConnectionSettings {
    const database = SqliteDatabase.open(databasePath);
    return new AgentConnectionSettings(
      new SqliteAgentConnectionSettingsStore(database),
      database,
    );
  }

  static fromDatabase(database: SqliteDatabase): AgentConnectionSettings {
    return new AgentConnectionSettings(
      new SqliteAgentConnectionSettingsStore(database),
      null,
    );
  }

  constructor(
    private readonly store: SqliteAgentConnectionSettingsStore,
    private readonly ownedDatabase: SqliteDatabase | null = null,
  ) {}

  get(agentId: AgentId, connectionId: string): AgentConnectionSettingRecord | null {
    return this.store.get(agentId, connectionId);
  }

  list(): AgentConnectionSettingRecord[] {
    return this.store.list();
  }

  setModelId(agentId: AgentId, connectionId: string, modelId: string): AgentConnectionSettingRecord {
    const normalizedConnectionId = connectionId.trim();
    const normalizedModelId = modelId.trim();
    if (!normalizedConnectionId) {
      throw new Error("Connection id is required");
    }
    if (!normalizedModelId) {
      throw new Error("Model id is required");
    }

    const record: AgentConnectionSettingRecord = {
      agentId,
      connectionId: normalizedConnectionId,
      modelId: normalizedModelId,
    };
    this.store.set(record);
    return record;
  }

  clear(agentId: AgentId, connectionId: string): void {
    this.store.clear(agentId, connectionId.trim());
  }

  clearConnection(connectionId: string): void {
    this.store.clearConnection(connectionId.trim());
  }

  close(): void {
    this.ownedDatabase?.close();
  }
}
