import { SUPPORTED_AGENT_IDS, type AgentId } from "@nile/core/models/agent/definitions";
import { SqliteDatabase } from "@nile/core/services/database";

export const MENUBAR_DISPLAY_MODES = ["app_entry", "ticker"] as const;

export type DesktopMenubarDisplayMode = (typeof MENUBAR_DISPLAY_MODES)[number];
export type DesktopMenubarDisplayState = {
  hasConfiguredTickerAgents: boolean;
  mode: DesktopMenubarDisplayMode;
  tickerAgentIds: AgentId[];
};

type MenubarDisplayRow = {
  mode: DesktopMenubarDisplayMode;
};

type MenubarTickerAgentRow = {
  agent_id: AgentId;
};

type MenubarTickerConfigRow = {
  configured: number;
};

const menubarDisplayModeSet = new Set<DesktopMenubarDisplayMode>(MENUBAR_DISPLAY_MODES);
const supportedAgentIdSet = new Set<AgentId>(SUPPORTED_AGENT_IDS);

export class DesktopMenubarDisplayStore {
  constructor(private readonly databasePath: string) {}

  read(): DesktopMenubarDisplayState {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      const modeRow = database.query<MenubarDisplayRow>(
        "SELECT mode FROM desktop_menubar_display WHERE id = 1",
      ).get();
      const tickerAgentRows = database.query<MenubarTickerAgentRow>(
        "SELECT agent_id FROM desktop_menubar_ticker_agents",
      ).all();
      const tickerConfigRow = database.query<MenubarTickerConfigRow>(
        "SELECT configured FROM desktop_menubar_ticker_config WHERE id = 1",
      ).get();
      const selectedAgentIds = new Set(
        tickerAgentRows
          .map((row) => row.agent_id)
          .filter((agentId): agentId is AgentId => supportedAgentIdSet.has(agentId)),
      );

      return {
        hasConfiguredTickerAgents: tickerConfigRow?.configured === 1,
        mode: menubarDisplayModeSet.has(modeRow?.mode ?? "app_entry")
          ? (modeRow?.mode ?? "app_entry")
          : "app_entry",
        tickerAgentIds: SUPPORTED_AGENT_IDS.filter((agentId) => selectedAgentIds.has(agentId)),
      };
    } finally {
      database.close();
    }
  }

  writeMode(mode: DesktopMenubarDisplayMode): DesktopMenubarDisplayState {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      database.transaction(() => {
        this.initialize(database);
        if (mode === "app_entry") {
          database.run("DELETE FROM desktop_menubar_display WHERE id = 1");
          return;
        }
        database.run(
          `
            INSERT INTO desktop_menubar_display (id, mode)
            VALUES (1, ?)
            ON CONFLICT(id) DO UPDATE SET mode = excluded.mode
          `,
          mode,
        );
      });
    } finally {
      database.close();
    }
    return this.read();
  }

  writeTickerAgentIds(agentIds: AgentId[]): DesktopMenubarDisplayState {
    const normalizedAgentIds = SUPPORTED_AGENT_IDS.filter((agentId) => agentIds.includes(agentId));
    const database = SqliteDatabase.open(this.databasePath);
    try {
      database.transaction(() => {
        this.initialize(database);
        database.run(
          `
            INSERT INTO desktop_menubar_ticker_config (id, configured)
            VALUES (1, 1)
            ON CONFLICT(id) DO UPDATE SET configured = excluded.configured
          `,
        );
        database.run("DELETE FROM desktop_menubar_ticker_agents");
        for (const agentId of normalizedAgentIds) {
          database.run(
            `
              INSERT INTO desktop_menubar_ticker_agents (agent_id)
              VALUES (?)
              ON CONFLICT(agent_id) DO NOTHING
            `,
            agentId,
          );
        }
      });
    } finally {
      database.close();
    }
    return this.read();
  }

  private initialize(database: SqliteDatabase): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS desktop_menubar_display (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        mode TEXT NOT NULL CHECK (mode IN ('app_entry', 'ticker'))
      );

      CREATE TABLE IF NOT EXISTS desktop_menubar_ticker_agents (
        agent_id TEXT PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS desktop_menubar_ticker_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        configured INTEGER NOT NULL CHECK (configured IN (0, 1))
      )
    `);
  }
}
