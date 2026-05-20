import { homedir } from "node:os";
import { resolve } from "node:path";

import { isAgentId, type AgentId, type AgentRuntimeCommandOverrides } from "@nile/core/models/agent";
import { SqliteDatabase } from "@nile/core/services/database";

type AgentRuntimeCommandRow = {
  agent_id: string;
  command_path: string;
};

export class AgentRuntimeCommandsStore {
  constructor(private readonly databasePath: string) {}

  read(): AgentRuntimeCommandOverrides {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      return this.readOverrides(database);
    } finally {
      database.close();
    }
  }

  update(agentId: AgentId, commandPath: string | null | undefined): AgentRuntimeCommandOverrides {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      return database.transaction(() => {
        this.initialize(database);
        const normalizedPath = this.normalizePath(commandPath);
        if (!normalizedPath) {
          database.run("DELETE FROM desktop_agent_runtime_commands WHERE agent_id = ?", agentId);
        } else {
          database.run(
            `
              INSERT INTO desktop_agent_runtime_commands (agent_id, command_path)
              VALUES (?, ?)
              ON CONFLICT(agent_id) DO UPDATE SET command_path = excluded.command_path
            `,
            agentId,
            normalizedPath,
          );
        }
        return this.readOverrides(database);
      });
    } finally {
      database.close();
    }
  }

  clear(): void {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      database.run("DELETE FROM desktop_agent_runtime_commands");
    } finally {
      database.close();
    }
  }

  private initialize(database: SqliteDatabase): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS desktop_agent_runtime_commands (
        agent_id TEXT PRIMARY KEY,
        command_path TEXT NOT NULL
      )
    `);
  }

  private readOverrides(database: SqliteDatabase): AgentRuntimeCommandOverrides {
    const rows = database
      .query<AgentRuntimeCommandRow>(
        `
          SELECT agent_id, command_path
          FROM desktop_agent_runtime_commands
          ORDER BY rowid
        `,
      )
      .all();
    return Object.fromEntries(
      rows.flatMap((row) => {
        if (!isAgentId(row.agent_id) || !row.command_path.trim()) {
          return [];
        }
        return [[row.agent_id, row.command_path.trim()]];
      }),
    ) as AgentRuntimeCommandOverrides;
  }

  private normalizePath(path: string | null | undefined): string | null {
    const trimmed = path?.trim();
    if (!trimmed) {
      return null;
    }

    const expanded = trimmed === "~"
      ? homedir()
      : trimmed.startsWith("~/")
        ? resolve(homedir(), trimmed.slice(2))
        : resolve(trimmed);
    return expanded.trim() || null;
  }
}
