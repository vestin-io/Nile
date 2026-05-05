import { SchemaMigrations } from "../database/SchemaMigrations";
import { SqliteDatabase } from "../database/SqliteDatabase";

export function initializeSqliteMutationHistorySchema(database: SqliteDatabase): void {
  new SchemaMigrations(database).apply("services.mutation_history", [
    {
      version: 1,
      statements: [
        `
          CREATE TABLE IF NOT EXISTS mutation_history (
            id TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL,
            type TEXT NOT NULL,
            connection_id TEXT NOT NULL,
            endpoint_label TEXT NOT NULL,
            access_label TEXT NOT NULL,
            status TEXT NOT NULL,
            rollback_of_mutation_id TEXT,
            started_at TEXT NOT NULL,
            completed_at TEXT,
            error_message TEXT
          );
        `,
        `
          CREATE TABLE IF NOT EXISTS mutation_history_files (
            mutation_id TEXT NOT NULL,
            path TEXT NOT NULL,
            before_snapshot_kind TEXT NOT NULL,
            before_snapshot_ref TEXT NOT NULL,
            existed_before INTEGER NOT NULL,
            before_checksum TEXT,
            after_checksum TEXT,
            PRIMARY KEY (mutation_id, path)
          );
        `,
        `
          CREATE INDEX IF NOT EXISTS idx_mutation_history_started_at_id
          ON mutation_history (started_at, id);
        `,
        `
          CREATE INDEX IF NOT EXISTS idx_mutation_history_latest_apply
          ON mutation_history (agent_id, type, status, completed_at, id);
        `,
        `
          CREATE INDEX IF NOT EXISTS idx_mutation_history_rollback_lookup
          ON mutation_history (type, status, agent_id, rollback_of_mutation_id);
        `,
      ],
    },
    {
      version: 2,
      statements: [
        "ALTER TABLE mutation_history ADD COLUMN connection_label TEXT;",
        `
          UPDATE mutation_history
          SET connection_label = access_label
          WHERE connection_label IS NULL OR connection_label = '';
        `,
      ],
    },
  ]);
}
