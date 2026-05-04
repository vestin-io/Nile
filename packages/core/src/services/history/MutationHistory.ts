import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

import { SqliteDatabase } from "../database/SqliteDatabase";
import { NileLogger } from "../NileLogger";
import { FileSnapshotStore } from "./FileSnapshotStore";
import { SecureSnapshotStore } from "./SecureSnapshotStore";
import { SqliteMutationHistoryStore } from "./SqliteMutationHistoryStore";
import {
  type MutationAfterFileInput,
  type MutationHistoryFileRecord,
  type MutationHistoryRecord,
  type RollbackLatestMutationResult,
  type StartMutationInput,
} from "./MutationHistoryTypes";
import type { AgentId } from "../../models/agent/Types";

export class MutationHistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MutationHistoryError";
  }
}

export class MutationHistory {
  static open(
    databasePath: string,
    options?: {
      historyRoot?: string;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): MutationHistory {
    const database = SqliteDatabase.open(databasePath);
    const historyRoot = options?.historyRoot ?? join(dirname(databasePath), "history");
    return new MutationHistory(
      database,
      new FileSnapshotStore(historyRoot),
      options?.secureSnapshotStore ?? new SecureSnapshotStore(),
      options?.logger ?? NileLogger.silent().child({ module: "mutation-history" }),
      database,
    );
  }

  static fromDatabase(
    databasePath: string,
    database: SqliteDatabase,
    options?: {
      historyRoot?: string;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): MutationHistory {
    const historyRoot = options?.historyRoot ?? join(dirname(databasePath), "history");
    return new MutationHistory(
      database,
      new FileSnapshotStore(historyRoot),
      options?.secureSnapshotStore ?? new SecureSnapshotStore(),
      options?.logger ?? NileLogger.silent().child({ module: "mutation-history" }),
      null,
    );
  }

  private readonly store: SqliteMutationHistoryStore;

  constructor(
    private readonly database: SqliteDatabase,
    private readonly fileSnapshots: FileSnapshotStore,
    private readonly secureSnapshots: SecureSnapshotStore,
    private readonly logger: NileLogger,
    private readonly ownedDatabase: SqliteDatabase | null = null,
  ) {
    this.store = new SqliteMutationHistoryStore(database);
  }

  start(input: StartMutationInput): MutationHistoryRecord {
    const mutationId = randomUUID();
    const startedAt = new Date().toISOString();
    const files: MutationHistoryFileRecord[] = [];

    try {
      files.push(...input.files.map((file, index): MutationHistoryFileRecord => {
        const snapshotRef = file.isSensitive
          ? `${mutationId}:secure:${index}`
          : `${mutationId}:${file.path}`;
        const snapshot = file.isSensitive
          ? this.secureSnapshots.writeBeforeSnapshot(snapshotRef, file.content)
          : this.fileSnapshots.writeBeforeSnapshot(mutationId, file.path, file.content);
        return {
          path: file.path,
          beforeSnapshotKind: file.isSensitive ? "secure" : "file",
          beforeSnapshotRef: snapshot.snapshotRef,
          existedBefore: file.existedBefore,
          beforeChecksum: snapshot.checksum,
          afterChecksum: null,
        };
      }));

      const record: MutationHistoryRecord = {
        id: mutationId,
        agentId: input.agentId,
        type: input.type,
        connectionId: input.connectionId,
        connectionLabel: input.connectionLabel,
        endpointLabel: input.endpointLabel,
        accessLabel: input.accessLabel,
        status: "started",
        rollbackOfMutationId: input.rollbackOfMutationId ?? null,
        startedAt,
        completedAt: null,
        errorMessage: null,
        files,
      };

      this.store.insert(record);
      this.logger.info("history.start", {
        mutationId: record.id,
        agentId: record.agentId,
        type: record.type,
        connectionId: record.connectionId,
        fileCount: record.files.length,
      });
      return record;
    } catch (error) {
      this.cleanupSnapshots(mutationId, files);
      throw error;
    }
  }

  markApplied(mutationId: string, files: MutationAfterFileInput[]): MutationHistoryRecord {
    const completedAt = new Date().toISOString();
    const record = this.store.markAppliedChecksums(
      mutationId,
      completedAt,
      files.map((file) => ({
        path: file.path,
        checksum: this.fileSnapshots.checksum(file.content),
      })),
    );

    this.logger.info("history.applied", {
      mutationId: record.id,
      agentId: record.agentId,
      type: record.type,
      connectionId: record.connectionId,
    });
    return record;
  }

  markFailed(mutationId: string, errorMessage: string): MutationHistoryRecord {
    const record = this.store.markStatus(
      mutationId,
      "failed",
      new Date().toISOString(),
      errorMessage,
    );

    this.logger.error("history.failed", new MutationHistoryError(errorMessage), {
      mutationId: record.id,
      agentId: record.agentId,
      type: record.type,
      connectionId: record.connectionId,
    });
    return record;
  }

  list(limit: number = 20): MutationHistoryRecord[] {
    return this.store.list(limit);
  }

  findLatestRollbackCandidate(agentId: AgentId): MutationHistoryRecord | null {
    return this.store.findLatestRollbackAgent(agentId);
  }

  rollbackLatest(agentId: AgentId): RollbackLatestMutationResult {
    const appliedMutation = this.findLatestRollbackCandidate(agentId);
    if (!appliedMutation) {
      throw new MutationHistoryError(`No applied Nile mutation is available for rollback for agent ${agentId}`);
    }

    const rollbackEntry = this.start({
      agentId,
      type: "rollback_latest",
      connectionId: appliedMutation.connectionId,
      connectionLabel: appliedMutation.connectionLabel,
      endpointLabel: appliedMutation.endpointLabel,
      accessLabel: appliedMutation.accessLabel,
      rollbackOfMutationId: appliedMutation.id,
      files: appliedMutation.files.map((file) => {
        const content = this.readCurrentFile(file.path);
        return {
          path: file.path,
          content,
          existedBefore: content !== null,
          isSensitive: file.beforeSnapshotKind === "secure",
        };
      }),
    });

    try {
      for (const file of appliedMutation.files) {
        const currentChecksum = this.fileSnapshots.readCurrentChecksum(file.path);
        if (currentChecksum !== file.afterChecksum) {
          throw new MutationHistoryError(
            `Cannot safely roll back ${appliedMutation.id}: live file drift detected for ${file.path}`,
          );
        }
      }

      for (const file of appliedMutation.files) {
        if (file.beforeSnapshotKind === "secure") {
          this.secureSnapshots.restoreSnapshot(file.beforeSnapshotRef, file.path, file.existedBefore);
          continue;
        }

        this.fileSnapshots.restoreSnapshot(file.beforeSnapshotRef, file.path, file.existedBefore);
      }

      const completed = this.markApplied(
        rollbackEntry.id,
        appliedMutation.files.map((file) => ({
          path: file.path,
          content: this.readCurrentFile(file.path),
        })),
      );
      const finalized = this.store.markStatus(
        completed.id,
        "rolled_back",
        new Date().toISOString(),
        null,
      );

      this.logger.info("history.rollback.success", {
        mutationId: finalized.id,
        agentId,
        rollbackOfMutationId: appliedMutation.id,
      });
      return {
        agentId,
        rollbackEntry: finalized,
        rolledBackEntry: appliedMutation,
      };
    } catch (error) {
      this.markFailedSafely(rollbackEntry.id, error, "history.rollback.mark_failed");
      throw error;
    }
  }

  close(): void {
    this.ownedDatabase?.close();
  }

  private readCurrentFile(targetPath: string): string | null {
    if (!existsSync(targetPath)) {
      return null;
    }

    return readFileSync(targetPath, "utf8");
  }

  private cleanupSnapshots(mutationId: string, files: MutationHistoryFileRecord[]): void {
    for (const file of files) {
      try {
        if (file.beforeSnapshotKind === "secure") {
          this.secureSnapshots.removeSnapshot(file.beforeSnapshotRef);
          continue;
        }

        this.fileSnapshots.removeSnapshot(file.beforeSnapshotRef);
      } catch (error) {
        this.logger.error("history.start.cleanup_failed", error, {
          mutationId,
          snapshotRef: file.beforeSnapshotRef,
        });
      }
    }
  }

  private markFailedSafely(mutationId: string, error: unknown, event: string): void {
    try {
      this.markFailed(
        mutationId,
        error instanceof Error ? error.message : String(error),
      );
    } catch (historyError) {
      this.logger.error(event, historyError, { mutationId });
    }
  }
}
