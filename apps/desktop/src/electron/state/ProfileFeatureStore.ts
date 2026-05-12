import { SqliteDatabase } from "@nile/core/services/database";

type ProfileFeatureRow = {
  enabled: number;
};

export class DesktopProfileFeatureStore {
  constructor(private readonly databasePath: string) {}

  read(): boolean {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      const row = database.query<ProfileFeatureRow>("SELECT enabled FROM desktop_profile_feature WHERE id = 1").get();
      return row?.enabled !== 0;
    } finally {
      database.close();
    }
  }

  write(enabled: boolean): boolean {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      database.transaction(() => {
        this.initialize(database);
        if (enabled) {
          database.run("DELETE FROM desktop_profile_feature WHERE id = 1");
          return;
        }
        database.run(
          `
            INSERT INTO desktop_profile_feature (id, enabled)
            VALUES (1, 0)
            ON CONFLICT(id) DO UPDATE SET enabled = excluded.enabled
          `,
        );
      });
      return enabled;
    } finally {
      database.close();
    }
  }

  private initialize(database: SqliteDatabase): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS desktop_profile_feature (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        enabled INTEGER NOT NULL CHECK (enabled IN (0, 1))
      )
    `);
  }
}
