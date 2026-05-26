import type { CredentialStorageBackend } from "@nile/core/services/credential";
import { SqliteDatabase } from "@nile/core/services/database";

import { parseDesktopPreferences } from "../../state/DesktopPreferences";

type AccessModeRow = {
  backend: string | null;
};

type DesktopPreferencesRow = {
  value: string;
};

export class DesktopEnvironmentStorageModeReader {
  constructor(private readonly databasePath: string) {}

  read(): CredentialStorageBackend | null {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      const establishedMode = this.readEstablishedMode(database);
      if (establishedMode) {
        return establishedMode;
      }
      return this.readPreferredMode(database);
    } finally {
      database.close();
    }
  }

  private readEstablishedMode(database: SqliteDatabase): CredentialStorageBackend | null {
    if (!this.hasTable(database, "accesses")) {
      return null;
    }
    const rows = database
      .query<AccessModeRow>(
        `
          SELECT DISTINCT credential_storage_backend AS backend
          FROM accesses
          WHERE credential_storage_backend IN ('system_secure_storage', 'encrypted_local_storage')
        `,
      )
      .all();
    if (rows.length !== 1) {
      return null;
    }
    return this.normalizeBackend(rows[0]?.backend ?? null);
  }

  private readPreferredMode(database: SqliteDatabase): CredentialStorageBackend | null {
    if (!this.hasTable(database, "desktop_preferences")) {
      return null;
    }
    const row = database
      .query<DesktopPreferencesRow>("SELECT value FROM desktop_preferences WHERE id = 1")
      .get();
    return parseDesktopPreferences(row?.value ?? null).credentialStorageMode;
  }

  private hasTable(database: SqliteDatabase, tableName: string): boolean {
    const row = database
      .query<{ name: string }, [string]>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get(tableName);
    return row?.name === tableName;
  }

  private normalizeBackend(value: string | null): CredentialStorageBackend | null {
    return value === "system_secure_storage" || value === "encrypted_local_storage"
      ? value
      : null;
  }
}
