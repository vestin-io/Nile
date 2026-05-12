import { homedir } from "node:os";
import { resolve } from "node:path";

import { resolveAgentHome, type AgentHomes } from "@nile/core/models/agent";
import { isAgentId, type AgentId } from "@nile/core/models/agent";
import { SqliteDatabase } from "@nile/core/services/database";

type AgentHomeRow = {
  agent_id: string;
  path: string;
};

export class AgentHomesStore {
  constructor(private readonly databasePath: string) {}

  read(): AgentHomes {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      return this.readHomes(database);
    } finally {
      database.close();
    }
  }

  update(agentId: AgentId, path: string | null | undefined): AgentHomes {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      return database.transaction(() => {
        this.initialize(database);
        const normalizedPath = this.normalizePath(path);
        if (!normalizedPath || normalizedPath === resolveAgentHome(agentId)) {
          database.run("DELETE FROM desktop_agent_homes WHERE agent_id = ?", agentId);
        } else {
          database.run(
            `
              INSERT INTO desktop_agent_homes (agent_id, path)
              VALUES (?, ?)
              ON CONFLICT(agent_id) DO UPDATE SET path = excluded.path
            `,
            agentId,
            normalizedPath,
          );
        }
        return this.readHomes(database);
      });
    } finally {
      database.close();
    }
  }

  private initialize(database: SqliteDatabase): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS desktop_agent_homes (
        agent_id TEXT PRIMARY KEY,
        path TEXT NOT NULL
      )
    `);
  }

  private readHomes(database: SqliteDatabase): AgentHomes {
    const rows = database
      .query<AgentHomeRow>(
        `
          SELECT agent_id, path
          FROM desktop_agent_homes
          ORDER BY rowid
        `,
      )
      .all();
    return Object.fromEntries(
      rows.flatMap((row) => {
        if (!isAgentId(row.agent_id) || !row.path.trim()) {
          return [];
        }
        return [[row.agent_id, row.path.trim()]];
      }),
    ) as AgentHomes;
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
