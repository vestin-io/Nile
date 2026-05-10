import { existsSync, readFileSync, rmSync } from "node:fs";

import { SqliteDatabase } from "@nile/core/services/database";

type NotificationMuteFile = {
  muted?: unknown;
};

type NotificationMuteRow = {
  muted: number;
};

export class DesktopNotificationMuteStore {
  constructor(
    private readonly databasePath: string,
    private readonly legacyFilePath?: string,
  ) {}

  read(): boolean {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      this.migrateLegacyFile(database);
      const row = database.query<NotificationMuteRow>("SELECT muted FROM desktop_notification_mute WHERE id = 1").get();
      return row?.muted === 1;
    } finally {
      database.close();
    }
  }

  write(muted: boolean): boolean {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      database.transaction(() => {
        this.initialize(database);
        this.migrateLegacyFile(database);
        if (!muted) {
          database.run("DELETE FROM desktop_notification_mute WHERE id = 1");
          return;
        }
        database.run(
          `
            INSERT INTO desktop_notification_mute (id, muted)
            VALUES (1, 1)
            ON CONFLICT(id) DO UPDATE SET muted = excluded.muted
          `,
        );
      });
      return muted;
    } finally {
      database.close();
    }
  }

  private initialize(database: SqliteDatabase): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS desktop_notification_mute (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        muted INTEGER NOT NULL CHECK (muted IN (0, 1))
      )
    `);
  }

  private migrateLegacyFile(database: SqliteDatabase): void {
    if (!this.legacyFilePath || !existsSync(this.legacyFilePath)) {
      return;
    }

    const hasRow = database
      .query<{ has_row: number }>("SELECT 1 AS has_row FROM desktop_notification_mute WHERE id = 1")
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

    try {
      const parsed = JSON.parse(raw) as NotificationMuteFile;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.muted === true) {
        database.run(
          `
            INSERT INTO desktop_notification_mute (id, muted)
            VALUES (1, 1)
            ON CONFLICT(id) DO UPDATE SET muted = excluded.muted
          `,
        );
      }
    } catch {
      // Ignore malformed legacy mute state and fall back to unmuted.
    }

    rmSync(this.legacyFilePath, { force: true });
  }
}
