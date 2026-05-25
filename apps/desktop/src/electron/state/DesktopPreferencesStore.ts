import { SqliteDatabase } from "@nile/core/services/database";

import {
  parseDesktopPreferences,
  readDefaultDesktopPreferences,
  serializeDesktopPreferences,
  type DesktopPreferences,
} from "../../state/DesktopPreferences";

type DesktopPreferencesRow = {
  value: string;
};

export class DesktopPreferencesStore {
  constructor(private readonly databasePath: string) {}

  read(): DesktopPreferences {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      const row = database.query<DesktopPreferencesRow>(
        "SELECT value FROM desktop_preferences WHERE id = 1",
      ).get();
      return parseDesktopPreferences(row?.value ?? null);
    } finally {
      database.close();
    }
  }

  write(preferences: DesktopPreferences): DesktopPreferences {
    const normalized = parseDesktopPreferences(serializeDesktopPreferences(preferences));
    const database = SqliteDatabase.open(this.databasePath);
    try {
      database.transaction(() => {
        this.initialize(database);
        database.run(
          `
            INSERT INTO desktop_preferences (id, value)
            VALUES (1, ?)
            ON CONFLICT(id) DO UPDATE SET value = excluded.value
          `,
          serializeDesktopPreferences(normalized),
        );
      });
      return normalized;
    } finally {
      database.close();
    }
  }

  migrateLegacy(raw: string | null): DesktopPreferences {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      const row = database.query<DesktopPreferencesRow>(
        "SELECT value FROM desktop_preferences WHERE id = 1",
      ).get();
      if (row?.value) {
        return parseDesktopPreferences(row.value);
      }

      const migrated = parseDesktopPreferences(raw);
      if (raw !== null) {
        database.run(
          `
            INSERT INTO desktop_preferences (id, value)
            VALUES (1, ?)
            ON CONFLICT(id) DO NOTHING
          `,
          serializeDesktopPreferences(migrated),
        );
        return migrated;
      }

      return readDefaultDesktopPreferences();
    } finally {
      database.close();
    }
  }

  private initialize(database: SqliteDatabase): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS desktop_preferences (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        value TEXT NOT NULL
      )
    `);
  }
}
