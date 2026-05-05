import type { CredentialSource } from "../../services/credential/Source";
import { SchemaMigrations, SqliteDatabase } from "../../services/database";
import type { AgentId } from "../agent";
import type { AuthMode } from "./AuthMode";
import type { AccessCredentialSyncState, AccessRecord } from "./Types";

type AccessRow = {
  id: string;
  endpoint_id: string;
  label: string;
  auth_mode: string;
  identity_key: string | null;
  openclaw_model_id: string | null;
  api_key_source: string | null;
  env_key: string | null;
  enabled_agents: string;
  credential_source_kind: string;
  credential_source_ref: string;
  credential_sync_issue: string | null;
  credential_sync_state: string | null;
  created_at: string;
  updated_at: string;
};

export class SqliteAccessStore {
  constructor(private readonly database: SqliteDatabase) {
    this.initialize();
  }

  insert(record: AccessRecord): void {
    this.database.run(
      `
        INSERT INTO accesses (
          id,
          endpoint_id,
          label,
          auth_mode,
          identity_key,
          openclaw_model_id,
          api_key_source,
          env_key,
          enabled_agents,
          credential_source_kind,
          credential_source_ref,
          credential_sync_state,
          credential_sync_issue,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      record.id,
      record.endpointId,
      record.label,
      record.authMode,
      record.identityKey ?? null,
      record.openclawModelId ?? null,
      record.apiKeySource ?? null,
      record.envKey ?? null,
      JSON.stringify(record.enabledAgents),
      record.credentialSource.kind,
      record.credentialSource.reference,
      record.credentialSyncState ?? "ready",
      record.credentialSyncIssue ?? null,
      record.createdAt,
      record.updatedAt,
    );
  }

  update(record: AccessRecord): void {
    this.database.run(
      `
        UPDATE accesses
        SET endpoint_id = ?,
            label = ?,
            auth_mode = ?,
            identity_key = ?,
            openclaw_model_id = ?,
            api_key_source = ?,
            env_key = ?,
            enabled_agents = ?,
            credential_sync_state = ?,
            credential_sync_issue = ?,
            updated_at = ?
        WHERE id = ?
      `,
      record.endpointId,
      record.label,
      record.authMode,
      record.identityKey ?? null,
      record.openclawModelId ?? null,
      record.apiKeySource ?? null,
      record.envKey ?? null,
      JSON.stringify(record.enabledAgents),
      record.credentialSyncState ?? "ready",
      record.credentialSyncIssue ?? null,
      record.updatedAt,
      record.id,
    );
  }

  setCredentialSyncState(
    accessId: string,
    state: AccessCredentialSyncState,
    issue: string | null,
    updatedAt: string,
  ): void {
    this.database.run(
      `
        UPDATE accesses
        SET credential_sync_state = ?,
            credential_sync_issue = ?,
            updated_at = ?
        WHERE id = ?
      `,
      state,
      issue,
      updatedAt,
      accessId,
    );
  }

  get(accessId: string): AccessRecord | null {
    const row = this.database
      .query<AccessRow, [string]>(
        `
          SELECT
            id,
            endpoint_id,
            label,
            auth_mode,
            identity_key,
            openclaw_model_id,
            api_key_source,
            env_key,
            enabled_agents,
            credential_source_kind,
            credential_source_ref,
            credential_sync_state,
            credential_sync_issue,
            created_at,
            updated_at
          FROM accesses
          WHERE id = ?
        `,
      )
      .get(accessId);

    return row ? this.mapRow(row) : null;
  }

  list(): AccessRecord[] {
    const rows = this.database
      .query<AccessRow, []>(
        `
          SELECT
            id,
            endpoint_id,
            label,
            auth_mode,
            identity_key,
            openclaw_model_id,
            api_key_source,
            env_key,
            enabled_agents,
            credential_source_kind,
            credential_source_ref,
            credential_sync_state,
            credential_sync_issue,
            created_at,
            updated_at
          FROM accesses
          ORDER BY created_at ASC, id ASC
        `,
      )
      .all();

    return rows.map((row) => this.mapRow(row));
  }

  remove(accessId: string): void {
    this.database.run("DELETE FROM accesses WHERE id = ?", accessId);
  }

  private initialize(): void {
    new SchemaMigrations(this.database).apply("models.accesses", [
      {
        version: 1,
        statements: [
          `
            CREATE TABLE IF NOT EXISTS accesses (
              id TEXT PRIMARY KEY,
              endpoint_id TEXT NOT NULL,
              label TEXT NOT NULL,
              auth_mode TEXT NOT NULL,
              identity_key TEXT,
              enabled_agents TEXT NOT NULL,
              credential_source_kind TEXT NOT NULL,
              credential_source_ref TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
          `,
        ],
      },
      { version: 2, statements: ["ALTER TABLE accesses ADD COLUMN openclaw_model_id TEXT;"] },
      { version: 3, statements: ["ALTER TABLE accesses ADD COLUMN api_key_source TEXT;"] },
      { version: 4, statements: ["ALTER TABLE accesses ADD COLUMN env_key TEXT;"] },
      {
        version: 5,
        statements: ["ALTER TABLE accesses ADD COLUMN credential_sync_state TEXT NOT NULL DEFAULT 'ready';"],
      },
      { version: 6, statements: ["ALTER TABLE accesses ADD COLUMN credential_sync_issue TEXT;"] },
    ]);
  }

  private mapRow(row: AccessRow): AccessRecord {
    return {
      id: row.id,
      endpointId: row.endpoint_id,
      label: row.label,
      authMode: row.auth_mode as AuthMode,
      ...(row.identity_key ? { identityKey: row.identity_key } : {}),
      ...(row.openclaw_model_id ? { openclawModelId: row.openclaw_model_id } : {}),
      ...(row.api_key_source === "direct" || row.api_key_source === "env_key"
        ? { apiKeySource: row.api_key_source }
        : {}),
      ...(row.env_key ? { envKey: row.env_key } : {}),
      enabledAgents: this.parseEnabledAgents(row.enabled_agents),
      credentialSource: this.mapCredentialSource(row),
      credentialSyncState: this.mapCredentialSyncState(row.credential_sync_state),
      ...(row.credential_sync_issue ? { credentialSyncIssue: row.credential_sync_issue } : {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapCredentialSource(row: AccessRow): CredentialSource {
    if (row.credential_source_kind !== "local") {
      throw new Error(`Unsupported credential source kind: ${row.credential_source_kind}`);
    }

    return {
      kind: "local",
      reference: row.credential_source_ref,
      scope: "access",
      allowLocalMaterialization: true,
    };
  }

  private mapCredentialSyncState(value: string | null): AccessCredentialSyncState {
    if (
      value === "pending_write"
      || value === "write_failed"
      || value === "pending_delete"
      || value === "delete_failed"
      || value === "ready"
    ) {
      return value;
    }
    return "ready";
  }

  private parseEnabledAgents(value: string): AgentId[] {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("Access enabled_agents must be a JSON array");
    }
    return parsed.filter((entry): entry is AgentId => typeof entry === "string") as AgentId[];
  }
}
