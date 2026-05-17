import { SqliteDatabase } from "../database/SqliteDatabase";
import {
  type MutationHistoryFileRecord,
  type MutationHistoryRecord,
  type MutationStatus,
  type MutationType,
} from "./MutationHistoryTypes";
import type { AgentId } from "../../models/agent/Definitions";
import { initializeSqliteMutationHistorySchema } from "./SqliteMutationHistorySchema";
import {
  mapMutationHistoryFiles,
  mapMutationHistoryRecord,
  type MutationHistoryFileRow,
  type MutationHistoryRow,
} from "./SqliteMutationHistoryRows";

export class SqliteMutationHistoryStore {
  constructor(private readonly database: SqliteDatabase) {
    initializeSqliteMutationHistorySchema(this.database);
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

    return row ? mapMutationHistoryRecord(row, this.readFiles(mutationId)) : null;
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
    return rows.map((row) => mapMutationHistoryRecord(row, filesByMutationId.get(row.id) ?? []));
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

    return row ? mapMutationHistoryRecord(row, this.readFiles(row.id)) : null;
  }

  private getOrThrow(mutationId: string): MutationHistoryRecord {
    const record = this.get(mutationId);
    if (!record) {
      throw new Error(`Mutation history entry not found after write: ${mutationId}`);
    }
    return record;
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
      files.push(...mapMutationHistoryFiles([row]));
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

    return mapMutationHistoryFiles(rows);
  }
}
