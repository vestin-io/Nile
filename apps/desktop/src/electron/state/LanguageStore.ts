import { SqliteDatabase } from "@nile/core/services/database";

import { normalizeLanguagePreference, type LanguagePreference } from "../../state/UiPreferences";

type LanguagePreferenceRow = {
  language: string;
};

export class DesktopLanguageStore {
  constructor(private readonly databasePath: string) {}

  read(): LanguagePreference {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      const row = database.query<LanguagePreferenceRow>(
        "SELECT language FROM desktop_language_preference WHERE id = 1",
      ).get();
      return normalizeLanguagePreference(row?.language);
    } finally {
      database.close();
    }
  }

  write(language: LanguagePreference): LanguagePreference {
    const normalizedLanguage = normalizeLanguagePreference(language);
    const database = SqliteDatabase.open(this.databasePath);
    try {
      database.transaction(() => {
        this.initialize(database);
        if (normalizedLanguage === "en") {
          database.run("DELETE FROM desktop_language_preference WHERE id = 1");
          return;
        }
        database.run(
          `
            INSERT INTO desktop_language_preference (id, language)
            VALUES (1, ?)
            ON CONFLICT(id) DO UPDATE SET language = excluded.language
          `,
          normalizedLanguage,
        );
      });
      return normalizedLanguage;
    } finally {
      database.close();
    }
  }

  private initialize(database: SqliteDatabase): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS desktop_language_preference (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        language TEXT NOT NULL
      )
    `);
  }
}
