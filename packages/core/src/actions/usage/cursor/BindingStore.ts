import { SchemaMigrations, SqliteDatabase } from "../../../services/database";
import type { CredentialSource } from "../../../services/credential/Source";
import type { CursorUsageBindingRecord } from "./Types";

type BindingRow = {
  connection_id: string;
  auth_id: string;
  workos_user_id: string;
  email: string | null;
  credential_source_kind: string;
  credential_source_ref: string;
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
          observed_at,
          last_verified_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      record.connectionId,
      record.accountFingerprint.authId,
      record.accountFingerprint.workosUserId,
      record.accountFingerprint.email ?? null,
      record.credentialSource.kind,
      record.credentialSource.reference,
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
            observed_at = ?,
            last_verified_at = ?,
            updated_at = ?
        WHERE connection_id = ?
      `,
      record.accountFingerprint.authId,
      record.accountFingerprint.workosUserId,
      record.accountFingerprint.email ?? null,
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
    ]);
  }

  private mapRow(row: BindingRow): CursorUsageBindingRecord {
    return {
      connectionId: row.connection_id,
      accountFingerprint: {
        authId: row.auth_id,
        workosUserId: row.workos_user_id,
        ...(row.email ? { email: row.email } : {}),
      },
      credentialSource: this.mapCredentialSource(row),
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
}
