import { SqliteDatabase } from "@nile/core/services/database";

type NotificationMuteRow = {
  muted: number;
};

export class DesktopNotificationMuteStore {
  constructor(private readonly databasePath: string) {}

  read(): boolean {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
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
}
