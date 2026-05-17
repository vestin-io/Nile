import { SchemaMigrations, SqliteDatabase } from "@nile/core/services/database";
import type { CursorUsageSnapshotFreshness, CursorUsageSnapshotInput, CursorUsageSnapshotRecord } from "./Types";

type SnapshotRow = {
  connection_id: string;
  auth_id: string;
  workos_user_id: string;
  email: string | null;
  total_percent_used: number;
  auto_percent_used: number;
  api_percent_used: number;
  billing_cycle_start: string;
  billing_cycle_end: string;
  fetched_at: string;
  freshness: string;
  created_at: string;
  updated_at: string;
};

export class CursorUsageSnapshotStore {
  static open(databasePath: string): CursorUsageSnapshotStore {
    return new CursorUsageSnapshotStore(SqliteDatabase.open(databasePath), true);
  }

  static fromDatabase(database: SqliteDatabase): CursorUsageSnapshotStore {
    return new CursorUsageSnapshotStore(database, false);
  }

  constructor(
    private readonly database: SqliteDatabase,
    private readonly ownsDatabase: boolean,
  ) {
    this.initialize();
  }

  get(connectionId: string): CursorUsageSnapshotRecord | null {
    const row = this.database
      .query<SnapshotRow, [string]>(
        `
          SELECT
            connection_id,
            auth_id,
            workos_user_id,
            email,
            total_percent_used,
            auto_percent_used,
            api_percent_used,
            billing_cycle_start,
            billing_cycle_end,
            fetched_at,
            freshness,
            created_at,
            updated_at
          FROM cursor_usage_snapshots
          WHERE connection_id = ?
        `,
      )
      .get(connectionId);

    return row ? this.mapRow(row) : null;
  }

  save(input: CursorUsageSnapshotInput): CursorUsageSnapshotRecord {
    const timestamp = new Date().toISOString();
    const current = this.get(input.connectionId);
    const record = this.normalizeInput(input, current?.createdAt ?? timestamp, timestamp);

    if (current) {
      this.database.run(
        `
          UPDATE cursor_usage_snapshots
          SET auth_id = ?,
              workos_user_id = ?,
              email = ?,
              total_percent_used = ?,
              auto_percent_used = ?,
              api_percent_used = ?,
              billing_cycle_start = ?,
              billing_cycle_end = ?,
              fetched_at = ?,
              freshness = ?,
              updated_at = ?
          WHERE connection_id = ?
        `,
        record.accountFingerprint.authId,
        record.accountFingerprint.workosUserId,
        record.accountFingerprint.email ?? null,
        record.totalPercentUsed,
        record.autoPercentUsed,
        record.apiPercentUsed,
        record.billingCycleStart,
        record.billingCycleEnd,
        record.fetchedAt,
        record.freshness,
        record.updatedAt,
        record.connectionId,
      );
      return this.getOrThrow(record.connectionId);
    }

    this.database.run(
      `
        INSERT INTO cursor_usage_snapshots (
          connection_id,
          auth_id,
          workos_user_id,
          email,
          total_percent_used,
          auto_percent_used,
          api_percent_used,
          billing_cycle_start,
          billing_cycle_end,
          fetched_at,
          freshness,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      record.connectionId,
      record.accountFingerprint.authId,
      record.accountFingerprint.workosUserId,
      record.accountFingerprint.email ?? null,
      record.totalPercentUsed,
      record.autoPercentUsed,
      record.apiPercentUsed,
      record.billingCycleStart,
      record.billingCycleEnd,
      record.fetchedAt,
      record.freshness,
      record.createdAt,
      record.updatedAt,
    );
    return this.getOrThrow(record.connectionId);
  }

  updateFreshness(connectionId: string, freshness: CursorUsageSnapshotFreshness): CursorUsageSnapshotRecord | null {
    const current = this.get(connectionId);
    if (!current) {
      return null;
    }

    this.database.run(
      `
        UPDATE cursor_usage_snapshots
        SET freshness = ?,
            updated_at = ?
        WHERE connection_id = ?
      `,
      freshness,
      new Date().toISOString(),
      connectionId,
    );
    return this.get(connectionId);
  }

  remove(connectionId: string): void {
    this.database.run("DELETE FROM cursor_usage_snapshots WHERE connection_id = ?", connectionId);
  }

  close(): void {
    if (this.ownsDatabase) {
      this.database.close();
    }
  }

  private getOrThrow(connectionId: string): CursorUsageSnapshotRecord {
    const record = this.get(connectionId);
    if (!record) {
      throw new Error(`Cursor usage snapshot not found: ${connectionId}`);
    }
    return record;
  }

  private initialize(): void {
    new SchemaMigrations(this.database).apply("actions.cursor_usage_snapshots", [
      {
        version: 1,
        statements: [
          `
            CREATE TABLE IF NOT EXISTS cursor_usage_snapshots (
              connection_id TEXT PRIMARY KEY,
              auth_id TEXT NOT NULL,
              workos_user_id TEXT NOT NULL,
              email TEXT,
              total_percent_used REAL NOT NULL,
              auto_percent_used REAL NOT NULL,
              api_percent_used REAL NOT NULL,
              billing_cycle_start TEXT NOT NULL,
              billing_cycle_end TEXT NOT NULL,
              fetched_at TEXT NOT NULL,
              freshness TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
          `,
        ],
      },
    ]);
  }

  private normalizeInput(
    input: CursorUsageSnapshotInput,
    createdAt: string,
    updatedAt: string,
  ): CursorUsageSnapshotRecord {
    const connectionId = input.connectionId.trim();
    if (!connectionId) {
      throw new Error("Cursor usage snapshot connection id is required");
    }
    return {
      connectionId,
      accountFingerprint: {
        authId: input.accountFingerprint.authId.trim(),
        workosUserId: input.accountFingerprint.workosUserId.trim(),
        ...(input.accountFingerprint.email?.trim() ? { email: input.accountFingerprint.email.trim() } : {}),
      },
      totalPercentUsed: this.normalizePercent(input.totalPercentUsed),
      autoPercentUsed: this.normalizePercent(input.autoPercentUsed),
      apiPercentUsed: this.normalizePercent(input.apiPercentUsed),
      billingCycleStart: this.normalizeTimestamp(input.billingCycleStart, "billingCycleStart"),
      billingCycleEnd: this.normalizeTimestamp(input.billingCycleEnd, "billingCycleEnd"),
      fetchedAt: this.normalizeTimestamp(input.fetchedAt, "fetchedAt"),
      freshness: input.freshness,
      createdAt,
      updatedAt,
    };
  }

  private normalizePercent(value: number): number {
    if (!Number.isFinite(value)) {
      throw new Error("Cursor usage percent must be finite");
    }
    return Math.max(0, Math.min(100, value));
  }

  private normalizeTimestamp(value: string, field: string): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new Error(`Cursor usage snapshot ${field} is required`);
    }
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Cursor usage snapshot ${field} must be a valid ISO timestamp`);
    }
    return date.toISOString();
  }

  private mapRow(row: SnapshotRow): CursorUsageSnapshotRecord {
    return {
      connectionId: row.connection_id,
      accountFingerprint: {
        authId: row.auth_id,
        workosUserId: row.workos_user_id,
        ...(row.email ? { email: row.email } : {}),
      },
      totalPercentUsed: row.total_percent_used,
      autoPercentUsed: row.auto_percent_used,
      apiPercentUsed: row.api_percent_used,
      billingCycleStart: row.billing_cycle_start,
      billingCycleEnd: row.billing_cycle_end,
      fetchedAt: row.fetched_at,
      freshness: row.freshness as CursorUsageSnapshotFreshness,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
