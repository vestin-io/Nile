import { SqliteDatabase } from "@nile/core/services/database";

import type { MenubarState, SettingsState } from "../../state/Types";

type SnapshotRow = {
  payload: string;
  version: number;
};

type DesktopStateSnapshot = {
  menubarState: MenubarState | null;
  settingsState: SettingsState | null;
};

const MENUBAR_STATE_KEY = "menubar_state";
const SETTINGS_STATE_KEY = "settings_state";
const SNAPSHOT_VERSION = 1;

export class DesktopStateSnapshotStore {
  constructor(private readonly databasePath: string) {}

  read(): DesktopStateSnapshot {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      return {
        menubarState: this.readValue(database, MENUBAR_STATE_KEY, isMenubarState),
        settingsState: this.readValue(database, SETTINGS_STATE_KEY, isSettingsState),
      };
    } finally {
      database.close();
    }
  }

  writeMenubarState(state: MenubarState): void {
    this.writeValue(MENUBAR_STATE_KEY, state);
  }

  writeSettingsState(state: SettingsState): void {
    this.writeValue(SETTINGS_STATE_KEY, state);
  }

  private readValue<T>(
    database: SqliteDatabase,
    key: string,
    validate: (value: unknown) => value is T,
  ): T | null {
    const row = database.query<SnapshotRow>(
      "SELECT payload, version FROM desktop_state_snapshots WHERE snapshot_key = ?",
    ).get(key);
    if (!row || row.version !== SNAPSHOT_VERSION) {
      return null;
    }

    try {
      const parsed = JSON.parse(row.payload) as unknown;
      return validate(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private writeValue(key: string, value: MenubarState | SettingsState): void {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      database.run(
        `
          INSERT INTO desktop_state_snapshots (snapshot_key, version, payload, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(snapshot_key) DO UPDATE SET
            version = excluded.version,
            payload = excluded.payload,
            updated_at = excluded.updated_at
        `,
        key,
        SNAPSHOT_VERSION,
        JSON.stringify(value),
      );
    } finally {
      database.close();
    }
  }

  private initialize(database: SqliteDatabase): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS desktop_state_snapshots (
        snapshot_key TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }
}

function isMenubarState(value: unknown): value is MenubarState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Array.isArray((value as { agents?: unknown }).agents);
}

function isSettingsState(value: unknown): value is SettingsState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.connections) || !Array.isArray(record.currentAgentConnections) || !Array.isArray(record.agents)) {
    return false;
  }
  if (typeof record.advanced !== "object" || record.advanced === null || Array.isArray(record.advanced)) {
    return false;
  }
  if (typeof record.detectedSetups !== "object" || record.detectedSetups === null || Array.isArray(record.detectedSetups)) {
    return false;
  }
  return true;
}
