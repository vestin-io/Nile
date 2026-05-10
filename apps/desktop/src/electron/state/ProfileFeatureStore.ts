import { existsSync, readFileSync, rmSync } from "node:fs";

import { SqliteDatabase } from "@nile/core/services/database";

type ProfileFeatureFile = {
  enabled?: unknown;
};

type ProfileFeatureRow = {
  enabled: number;
};

export class DesktopProfileFeatureStore {
  constructor(
    private readonly databasePath: string,
    private readonly legacyFilePath?: string,
  ) {}

  read(): boolean {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      this.migrateLegacyFile(database);
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
        this.migrateLegacyFile(database);
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

  private migrateLegacyFile(database: SqliteDatabase): void {
    if (!this.legacyFilePath || !existsSync(this.legacyFilePath)) {
      return;
    }

    const hasRow = database
      .query<{ has_row: number }>("SELECT 1 AS has_row FROM desktop_profile_feature WHERE id = 1")
      .get();
    if (hasRow?.has_row === 1) {
      rmSync(this.legacyFilePath, { force: true });
      return;
    }

    const raw = readFileSync(this.legacyFilePath, "utf8");
    if (!raw.trim()) {
      rmSync(this.legacyFilePath, { force: true });
      return;
    }

    let parsed: ProfileFeatureFile;
    try {
      parsed = JSON.parse(raw) as ProfileFeatureFile;
    } catch {
      rmSync(this.legacyFilePath, { force: true });
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      rmSync(this.legacyFilePath, { force: true });
      return;
    }

    if (parsed.enabled === false) {
      database.run(
        `
          INSERT INTO desktop_profile_feature (id, enabled)
          VALUES (1, 0)
          ON CONFLICT(id) DO UPDATE SET enabled = excluded.enabled
        `,
      );
    }

    rmSync(this.legacyFilePath, { force: true });
  }
}
