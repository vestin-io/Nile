import { SqliteDatabase } from "../database/SqliteDatabase";
import {
  type MutationHistoryFileRecord,
  type MutationHistoryRecord,
  type MutationStatus,
  type MutationType,
} from "./MutationHistoryTypes";
import type { AgentId } from "../../models/agent/Types";

type MutationHistoryRow = {
  id: string;
  agent_id: string;
  type: string;
  connection_id: string;
  connection_label: string | null;
  endpoint_label: string;
  access_label: string;
  status: string;
  rollback_of_mutation_id: string | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
};

type MutationHistoryFileRow = {
  mutation_id: string;
  path: string;
  before_snapshot_kind: string;
  before_snapshot_ref: string;
  existed_before: number;
  before_checksum: string | null;
  after_checksum: string | null;
};

export class SqliteMutationHistoryStore {
  constructor(private readonly database: SqliteDatabase) {
    this.initialize();
  }

  insert(record: MutationHistoryRecord): void {
    this.database.transaction(() => {
      this.database.run(
        `
          INSERT INTO mutation_history (
            id,
            agent_id,
            type,
            connection_id,
            connection_label,
            endpoint_label,
            access_label,
            status,
            rollback_of_mutation_id,
            started_at,
            completed_at,
            error_message
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        record.id,
        record.agentId,
        record.type,
        record.connectionId,
        record.connectionLabel,
        record.endpointLabel,
        record.accessLabel,
        record.status,
        record.rollbackOfMutationId,
        record.startedAt,
        record.completedAt,
        record.errorMessage,
      );

      for (const file of record.files) {
        this.database.run(
          `
            INSERT INTO mutation_history_files (
              mutation_id,
              path,
              before_snapshot_kind,
              before_snapshot_ref,
              existed_before,
              before_checksum,
              after_checksum
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          record.id,
          file.path,
          file.beforeSnapshotKind,
          file.beforeSnapshotRef,
          file.existedBefore ? 1 : 0,
          file.beforeChecksum,
          file.afterChecksum,
        );
      }
    });
  }

  get(mutationId: string): MutationHistoryRecord | null {
    const row = this.database
      .query<MutationHistoryRow, [string]>(
        `
          SELECT
            id,
            agent_id,
            type,
            connection_id,
            connection_label,
            endpoint_label,
            access_label,
            status,
            rollback_of_mutation_id,
            started_at,
            completed_at,
            error_message
          FROM mutation_history
          WHERE id = ?
        `,
      )
      .get(mutationId);

    return row ? this.mapRecord(row) : null;
  }

  list(limit: number): MutationHistoryRecord[] {
    const rows = this.database
      .query<MutationHistoryRow, [number]>(
        `
          SELECT
            id,
            agent_id,
            type,
            connection_id,
            connection_label,
            endpoint_label,
            access_label,
            status,
            rollback_of_mutation_id,
            started_at,
            completed_at,
            error_message
          FROM mutation_history
          ORDER BY started_at DESC, id DESC
          LIMIT ?
        `,
      )
      .all(limit);

    const filesByMutationId = this.readFilesForMutations(rows.map((row) => row.id));
    return rows.map((row) => this.mapRecord(row, filesByMutationId.get(row.id) ?? []));
  }

  markAppliedChecksums(
    mutationId: string,
    completedAt: string,
    files: Array<{ path: string; checksum: string | null }>,
  ): MutationHistoryRecord {
    this.database.transaction(() => {
      for (const file of files) {
        this.database.run(
          `
            UPDATE mutation_history_files
            SET after_checksum = ?
            WHERE mutation_id = ? AND path = ?
          `,
          file.checksum,
          mutationId,
          file.path,
        );
      }

      this.database.run(
        `
          UPDATE mutation_history
          SET status = ?, completed_at = ?, error_message = NULL
          WHERE id = ?
        `,
        "applied",
        completedAt,
        mutationId,
      );
    });
    return this.getOrThrow(mutationId);
  }

  markStatus(
    mutationId: string,
    status: MutationStatus,
    completedAt: string,
    errorMessage: string | null,
  ): MutationHistoryRecord {
    this.database.run(
      `
        UPDATE mutation_history
        SET status = ?, completed_at = ?, error_message = ?
        WHERE id = ?
      `,
      status,
      completedAt,
      errorMessage,
      mutationId,
    );

    return this.getOrThrow(mutationId);
  }

  findLatestRollbackAgent(agentId: AgentId): MutationHistoryRecord | null {
    const row = this.database
      .query<MutationHistoryRow, [string]>(
        `
          SELECT
            id,
            agent_id,
            type,
            connection_id,
            connection_label,
            endpoint_label,
            access_label,
            status,
            rollback_of_mutation_id,
            started_at,
            completed_at,
            error_message
          FROM mutation_history AS m
          WHERE m.agent_id = ?
            AND m.type = 'apply_selection'
            AND m.status = 'applied'
            AND NOT EXISTS (
              SELECT 1
              FROM mutation_history AS r
              WHERE r.type = 'rollback_latest'
                AND r.status = 'rolled_back'
                AND r.agent_id = m.agent_id
                AND r.rollback_of_mutation_id = m.id
            )
          ORDER BY m.completed_at DESC, m.id DESC
          LIMIT 1
        `,
      )
      .get(agentId);

    return row ? this.mapRecord(row) : null;
  }

  private getOrThrow(mutationId: string): MutationHistoryRecord {
    const record = this.get(mutationId);
    if (!record) {
      throw new Error(`Mutation history entry not found after write: ${mutationId}`);
    }
    return record;
  }

  private mapRecord(
    row: MutationHistoryRow,
    files: MutationHistoryFileRecord[] = this.readFiles(row.id),
  ): MutationHistoryRecord {
    return {
      id: row.id,
      agentId: row.agent_id as AgentId,
      type: row.type as MutationType,
      connectionId: row.connection_id,
      connectionLabel: row.connection_label ?? row.access_label,
      endpointLabel: row.endpoint_label,
      accessLabel: row.access_label,
      status: row.status as MutationStatus,
      rollbackOfMutationId: row.rollback_of_mutation_id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      errorMessage: row.error_message,
      files,
    };
  }

  private readFilesForMutations(
    mutationIds: string[],
  ): Map<string, MutationHistoryFileRecord[]> {
    if (mutationIds.length === 0) {
      return new Map();
    }

    const placeholders = mutationIds.map(() => "?").join(", ");
    const rows = this.database
      .query<MutationHistoryFileRow, string[]>(
        `
          SELECT
            mutation_id,
            path,
            before_snapshot_kind,
            before_snapshot_ref,
            existed_before,
            before_checksum,
            after_checksum
          FROM mutation_history_files
          WHERE mutation_id IN (${placeholders})
          ORDER BY mutation_id ASC, path ASC
        `,
      )
      .all(...mutationIds);

    const filesByMutationId = new Map<string, MutationHistoryFileRecord[]>();
    for (const row of rows) {
      const files = filesByMutationId.get(row.mutation_id) ?? [];
      files.push({
        path: row.path,
        beforeSnapshotKind: row.before_snapshot_kind as "file" | "secure",
        beforeSnapshotRef: row.before_snapshot_ref,
        existedBefore: row.existed_before === 1,
        beforeChecksum: row.before_checksum,
        afterChecksum: row.after_checksum,
      });
      filesByMutationId.set(row.mutation_id, files);
    }

    return filesByMutationId;
  }

  private readFiles(mutationId: string): MutationHistoryFileRecord[] {
    const rows = this.database
      .query<MutationHistoryFileRow, [string]>(
        `
          SELECT
            mutation_id,
            path,
            before_snapshot_kind,
            before_snapshot_ref,
            existed_before,
            before_checksum,
            after_checksum
          FROM mutation_history_files
          WHERE mutation_id = ?
          ORDER BY path ASC
        `,
      )
      .all(mutationId);

    return rows.map((row) => ({
      path: row.path,
      beforeSnapshotKind: row.before_snapshot_kind as "file" | "secure",
      beforeSnapshotRef: row.before_snapshot_ref,
      existedBefore: row.existed_before === 1,
      beforeChecksum: row.before_checksum,
      afterChecksum: row.after_checksum,
    }));
  }

  private initialize(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS mutation_history (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        type TEXT NOT NULL,
        connection_id TEXT NOT NULL,
        connection_label TEXT,
        endpoint_label TEXT NOT NULL,
        access_label TEXT NOT NULL,
        status TEXT NOT NULL,
        rollback_of_mutation_id TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        error_message TEXT
      );

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

      CREATE INDEX IF NOT EXISTS idx_mutation_history_started_at_id
      ON mutation_history (started_at, id);

      CREATE INDEX IF NOT EXISTS idx_mutation_history_latest_apply
      ON mutation_history (agent_id, type, status, completed_at, id);

      CREATE INDEX IF NOT EXISTS idx_mutation_history_rollback_lookup
      ON mutation_history (type, status, agent_id, rollback_of_mutation_id);
    `);

    const columns = this.database
      .query<{ name: string }, []>("PRAGMA table_info(mutation_history)")
      .all();
    if (!columns.some((column) => column.name === "connection_label")) {
      this.database.exec("ALTER TABLE mutation_history ADD COLUMN connection_label TEXT");
    }
    this.database.exec(`
      UPDATE mutation_history
      SET connection_label = access_label
      WHERE connection_label IS NULL OR connection_label = ''
    `);
  }
}
