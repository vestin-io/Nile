import { SchemaMigrations, SqliteDatabase } from "@nile/core/services/database";
import type { CredentialSource } from "@nile/core/services/credential/Source";
import {
  SUPPORTED_CREDENTIAL_STORAGE_BACKENDS,
  type CredentialStorageBackend,
} from "@nile/core/services/credential";
import type { CursorUsageBindingRecord } from "./Types";

type BindingRow = {
  connection_id: string;
  auth_id: string;
  workos_user_id: string;
  email: string | null;
  credential_source_kind: string;
  credential_source_ref: string;
  credential_storage_backend: string | null;
  observed_at: string;
  last_verified_at: string;
  created_at: string;
  updated_at: string;
};

export class SqliteBindingStore {
  constructor(private readonly database: SqliteDatabase) {
    this.initialize();
  }

  insert(record: CursorUsageBindingRecord): void {
    this.database.run(
      `
        INSERT INTO cursor_usage_bindings (
          connection_id,
          auth_id,
          workos_user_id,
          email,
          credential_source_kind,
          credential_source_ref,
          credential_storage_backend,
          observed_at,
          last_verified_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      record.connectionId,
      record.accountFingerprint.authId,
      record.accountFingerprint.workosUserId,
      record.accountFingerprint.email ?? null,
      record.credentialSource.kind,
      record.credentialSource.reference,
      record.credentialStorageBackend ?? null,
      record.observedAt,
      record.lastVerifiedAt,
      record.createdAt,
      record.updatedAt,
    );
  }

  update(record: CursorUsageBindingRecord): void {
    this.database.run(
      `
        UPDATE cursor_usage_bindings
        SET auth_id = ?,
            workos_user_id = ?,
            email = ?,
            credential_storage_backend = ?,
            observed_at = ?,
            last_verified_at = ?,
            updated_at = ?
        WHERE connection_id = ?
      `,
      record.accountFingerprint.authId,
      record.accountFingerprint.workosUserId,
      record.accountFingerprint.email ?? null,
      record.credentialStorageBackend ?? null,
      record.observedAt,
      record.lastVerifiedAt,
      record.updatedAt,
      record.connectionId,
    );
  }

  get(connectionId: string): CursorUsageBindingRecord | null {
    const row = this.database
      .query<BindingRow, [string]>(
        `
          SELECT
            connection_id,
            auth_id,
            workos_user_id,
            email,
            credential_source_kind,
            credential_source_ref,
            credential_storage_backend,
            observed_at,
            last_verified_at,
            created_at,
            updated_at
          FROM cursor_usage_bindings
          WHERE connection_id = ?
        `,
      )
      .get(connectionId);

    return row ? this.mapRow(row) : null;
  }

  remove(connectionId: string): void {
    this.database.run("DELETE FROM cursor_usage_bindings WHERE connection_id = ?", connectionId);
  }

  private initialize(): void {
    new SchemaMigrations(this.database).apply("actions.cursor_usage_bindings", [
      {
        version: 1,
        statements: [
          `
            CREATE TABLE IF NOT EXISTS cursor_usage_bindings (
              connection_id TEXT PRIMARY KEY,
              auth_id TEXT NOT NULL,
              workos_user_id TEXT NOT NULL,
              email TEXT,
              credential_source_kind TEXT NOT NULL,
              credential_source_ref TEXT NOT NULL,
              observed_at TEXT NOT NULL,
              last_verified_at TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
          `,
        ],
      },
      {
        version: 2,
        statements: ["ALTER TABLE cursor_usage_bindings ADD COLUMN credential_storage_backend TEXT;"],
      },
    ]);
  }

  private mapRow(row: BindingRow): CursorUsageBindingRecord {
    const credentialStorageBackend = this.mapCredentialStorageBackend(row.credential_storage_backend);
    return {
      connectionId: row.connection_id,
      accountFingerprint: {
        authId: row.auth_id,
        workosUserId: row.workos_user_id,
        ...(row.email ? { email: row.email } : {}),
      },
      credentialSource: this.mapCredentialSource(row),
      ...(credentialStorageBackend ? { credentialStorageBackend } : {}),
      observedAt: row.observed_at,
      lastVerifiedAt: row.last_verified_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapCredentialSource(row: BindingRow): CredentialSource {
    if (row.credential_source_kind !== "local") {
      throw new Error(`Unsupported credential source kind: ${row.credential_source_kind}`);
    }

    return {
      kind: "local",
      reference: row.credential_source_ref,
      scope: "usage",
      allowLocalMaterialization: true,
    };
  }

  private mapCredentialStorageBackend(value: string | null): CredentialStorageBackend | undefined {
    if (value === null) {
      return undefined;
    }
    if (SUPPORTED_CREDENTIAL_STORAGE_BACKENDS.includes(value as CredentialStorageBackend)) {
      return value as CredentialStorageBackend;
    }
    throw new Error(`Unsupported credential storage backend in cursor_usage_bindings: ${value}`);
  }
}
