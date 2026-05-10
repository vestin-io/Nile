import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";

import type { DesktopConnectionAlert } from "../../state/Types";
import { canonicalizeUsageMetricKey } from "../../state/UsageSummary";
import { SqliteDatabase } from "@nile/core/services/database";

type ConnectionAlertFile = {
  alertsByConnectionId?: unknown;
};

type ConnectionAlertRow = {
  id: string;
  connection_id: string;
  metric_key: string;
  metric_label: string;
  type: string;
  threshold_percent: number | null;
  enabled: number;
};

export type CreateConnectionAlertInput = {
  connectionId: string;
  metricKey: string;
  metricLabel: string;
  enabled: boolean;
} & (
  | {
    type: "low-percent";
    thresholdPercent: number;
  }
  | {
    type: "renewed";
  }
);

export type UpdateConnectionAlertInput = {
  alertId: string;
  connectionId: string;
  metricKey: string;
  metricLabel: string;
  enabled: boolean;
} & (
  | {
    type: "low-percent";
    thresholdPercent: number;
  }
  | {
    type: "renewed";
  }
);

export class ConnectionAlertStore {
  private cachedAlertsByConnectionId: Map<string, DesktopConnectionAlert[]> | null = null;

  constructor(
    private readonly databasePath: string,
    private readonly legacyFilePath?: string,
  ) {}

  list(connectionId: string): DesktopConnectionAlert[] {
    return this.readAlertsByConnectionId().get(this.normalizeConnectionId(connectionId)) ?? [];
  }

  listByConnectionId(): Map<string, DesktopConnectionAlert[]> {
    return this.readAlertsByConnectionId();
  }

  clearCache(): void {
    this.cachedAlertsByConnectionId = null;
  }

  create(input: CreateConnectionAlertInput): DesktopConnectionAlert {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      return database.transaction(() => {
        this.initialize(database);
        this.migrateLegacyFile(database);
        const alertsByConnectionId = this.readAlertsByConnectionIdFromDatabase(database);
        const connectionId = this.normalizeConnectionId(input.connectionId);
        const nextAlert = this.createAlert(randomUUID(), input);
        const existingAlerts = alertsByConnectionId.get(connectionId) ?? [];
        this.assertAlertAvailable(existingAlerts, nextAlert);
        database.run(
          `
            INSERT INTO desktop_connection_alerts (
              id,
              connection_id,
              metric_key,
              metric_label,
              type,
              threshold_percent,
              enabled
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          nextAlert.id,
          connectionId,
          nextAlert.metricKey,
          nextAlert.metricLabel,
          nextAlert.type,
          nextAlert.type === "low-percent" ? nextAlert.thresholdPercent : null,
          nextAlert.enabled ? 1 : 0,
        );
        this.cachedAlertsByConnectionId = null;
        return nextAlert;
      });
    } finally {
      database.close();
    }
  }

  update(input: UpdateConnectionAlertInput): DesktopConnectionAlert {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      return database.transaction(() => {
        this.initialize(database);
        this.migrateLegacyFile(database);
        const alertsByConnectionId = this.readAlertsByConnectionIdFromDatabase(database);
        const connectionId = this.normalizeConnectionId(input.connectionId);
        const alerts = [...(alertsByConnectionId.get(connectionId) ?? [])];
        const alertIndex = alerts.findIndex((alert) => alert.id === input.alertId);
        if (alertIndex < 0) {
          throw new Error(`Connection alert not found: ${input.alertId}`);
        }

        const updatedAlert = this.createAlert(alerts[alertIndex].id, input);
        this.assertAlertAvailable(alerts, updatedAlert, updatedAlert.id);
        database.run(
          `
            UPDATE desktop_connection_alerts
            SET
              connection_id = ?,
              metric_key = ?,
              metric_label = ?,
              type = ?,
              threshold_percent = ?,
              enabled = ?
            WHERE id = ?
          `,
          connectionId,
          updatedAlert.metricKey,
          updatedAlert.metricLabel,
          updatedAlert.type,
          updatedAlert.type === "low-percent" ? updatedAlert.thresholdPercent : null,
          updatedAlert.enabled ? 1 : 0,
          updatedAlert.id,
        );
        this.cachedAlertsByConnectionId = null;
        return updatedAlert;
      });
    } finally {
      database.close();
    }
  }

  delete(connectionId: string, alertId: string): void {
    const database = SqliteDatabase.open(this.databasePath);
    try {
      database.transaction(() => {
        this.initialize(database);
        this.migrateLegacyFile(database);
        const deleted = database
          .query<{ id: string }>("SELECT id FROM desktop_connection_alerts WHERE connection_id = ? AND id = ?")
          .get(this.normalizeConnectionId(connectionId), alertId);
        if (!deleted) {
          throw new Error(`Connection alert not found: ${alertId}`);
        }
        database.run("DELETE FROM desktop_connection_alerts WHERE id = ?", alertId);
        this.cachedAlertsByConnectionId = null;
      });
    } finally {
      database.close();
    }
  }

  private initialize(database: SqliteDatabase): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS desktop_connection_alerts (
        id TEXT PRIMARY KEY,
        connection_id TEXT NOT NULL,
        metric_key TEXT NOT NULL,
        metric_label TEXT NOT NULL,
        type TEXT NOT NULL,
        threshold_percent INTEGER,
        enabled INTEGER NOT NULL CHECK (enabled IN (0, 1))
      );

      CREATE INDEX IF NOT EXISTS desktop_connection_alerts_connection_idx
      ON desktop_connection_alerts (connection_id);
    `);
  }

  private readAlertsByConnectionId(): Map<string, DesktopConnectionAlert[]> {
    if (this.cachedAlertsByConnectionId) {
      return this.cloneAlertsByConnectionId(this.cachedAlertsByConnectionId);
    }

    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      this.migrateLegacyFile(database);
      const result = this.readAlertsByConnectionIdFromDatabase(database);
      this.cachedAlertsByConnectionId = this.cloneAlertsByConnectionId(result);
      return result;
    } finally {
      database.close();
    }
  }

  private readAlertsByConnectionIdFromDatabase(database: SqliteDatabase): Map<string, DesktopConnectionAlert[]> {
    const rows = database
      .query<ConnectionAlertRow>(
        `
          SELECT
            id,
            connection_id,
            metric_key,
            metric_label,
            type,
            threshold_percent,
            enabled
          FROM desktop_connection_alerts
          ORDER BY connection_id, metric_key, rowid
        `,
      )
      .all();

    const alertsByConnectionId = new Map<string, DesktopConnectionAlert[]>();
    for (const row of rows) {
      const alert = this.readDatabaseAlert(row);
      if (!alert) {
        continue;
      }
      const connectionId = this.normalizeConnectionId(row.connection_id);
      const current = alertsByConnectionId.get(connectionId) ?? [];
      current.push(alert);
      alertsByConnectionId.set(connectionId, current);
    }

    for (const [connectionId, alerts] of alertsByConnectionId.entries()) {
      alertsByConnectionId.set(connectionId, this.sortAlerts(alerts));
    }
    return alertsByConnectionId;
  }

  private readDatabaseAlert(row: ConnectionAlertRow): DesktopConnectionAlert | null {
    const normalizedMetricKey = this.normalizeMetricKey(row.metric_key);
    const metricLabel = this.readMetricLabel(row.metric_label, normalizedMetricKey);
    const enabled = row.enabled === 1;
    if (row.type === "renewed") {
      return {
        id: row.id,
        type: "renewed",
        metricKey: normalizedMetricKey,
        metricLabel,
        enabled,
      };
    }
    if (row.type !== "low-percent" || row.threshold_percent === null) {
      return null;
    }
    return {
      id: row.id,
      type: "low-percent",
      metricKey: normalizedMetricKey,
      metricLabel,
      thresholdPercent: this.normalizeThresholdPercent(row.threshold_percent),
      enabled,
    };
  }

  private migrateLegacyFile(database: SqliteDatabase): void {
    if (!this.legacyFilePath || !existsSync(this.legacyFilePath)) {
      return;
    }

    const raw = readFileSync(this.legacyFilePath, "utf8");
    if (!raw.trim()) {
      rmSync(this.legacyFilePath, { force: true });
      return;
    }

    try {
      const parsed = JSON.parse(raw) as ConnectionAlertFile;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        rmSync(this.legacyFilePath, { force: true });
        return;
      }
      if (!parsed.alertsByConnectionId || typeof parsed.alertsByConnectionId !== "object" || Array.isArray(parsed.alertsByConnectionId)) {
        rmSync(this.legacyFilePath, { force: true });
        return;
      }

      for (const [connectionId, value] of Object.entries(parsed.alertsByConnectionId)) {
        for (const alert of this.readAlerts(value)) {
          database.run(
            `
              INSERT INTO desktop_connection_alerts (
                id,
                connection_id,
                metric_key,
                metric_label,
                type,
                threshold_percent,
                enabled
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                connection_id = excluded.connection_id,
                metric_key = excluded.metric_key,
                metric_label = excluded.metric_label,
                type = excluded.type,
                threshold_percent = excluded.threshold_percent,
                enabled = excluded.enabled
            `,
            alert.id,
            this.normalizeConnectionId(connectionId),
            alert.metricKey,
            alert.metricLabel,
            alert.type,
            alert.type === "low-percent" ? alert.thresholdPercent : null,
            alert.enabled ? 1 : 0,
          );
        }
      }
    } catch {
      // Ignore malformed legacy alert config and fall back to an empty alert set.
    }

    rmSync(this.legacyFilePath, { force: true });
  }

  private readAlerts(value: unknown): DesktopConnectionAlert[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const alerts = value.flatMap((entry) => this.readLegacyAlert(entry));
    return this.sortAlerts(alerts);
  }

  private readLegacyAlert(entry: unknown): DesktopConnectionAlert[] {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.id !== "string" || !record.id.trim()) {
      return [];
    }
    if (typeof record.metricKey !== "string" || !record.metricKey.trim()) {
      return [];
    }
    const normalizedId = record.id.trim();
    const normalizedMetricKey = this.normalizeMetricKey(record.metricKey);
    const enabled = record.enabled !== false;
    const metricLabel = this.readMetricLabel(record.metricLabel, normalizedMetricKey);
    if (record.type === "renewed") {
      return [{
        id: normalizedId,
        type: "renewed",
        metricKey: normalizedMetricKey,
        metricLabel,
        enabled,
      }];
    }
    if (record.type !== undefined && record.type !== "low-percent") {
      return [];
    }
    if (typeof record.thresholdPercent !== "number" || !Number.isFinite(record.thresholdPercent)) {
      return [];
    }

    return [{
      id: normalizedId,
      type: "low-percent",
      metricKey: normalizedMetricKey,
      metricLabel,
      thresholdPercent: this.normalizeThresholdPercent(record.thresholdPercent),
      enabled,
    }];
  }

  private sortAlerts(alerts: DesktopConnectionAlert[]): DesktopConnectionAlert[] {
    return [...alerts].sort((left, right) => {
      const metricCompare = left.metricKey.localeCompare(right.metricKey);
      if (metricCompare !== 0) {
        return metricCompare;
      }
      const typeCompare = this.readSortOrder(left) - this.readSortOrder(right);
      if (typeCompare !== 0) {
        return typeCompare;
      }
      if (left.type === "low-percent" && right.type === "low-percent") {
        return right.thresholdPercent - left.thresholdPercent;
      }
      return left.id.localeCompare(right.id);
    });
  }

  private assertAlertAvailable(
    alerts: DesktopConnectionAlert[],
    nextAlert: DesktopConnectionAlert,
    currentAlertId?: string,
  ): void {
    const duplicate = alerts.find((alert) =>
      alert.id !== currentAlertId
      && this.matchesDuplicateAlert(alert, nextAlert));
    if (duplicate) {
      if (nextAlert.type === "renewed") {
        throw new Error(`Connection alert already exists for ${nextAlert.metricKey} renewals`);
      }
      throw new Error(`Connection alert already exists for ${nextAlert.metricKey} at ${nextAlert.thresholdPercent}%`);
    }
  }

  private matchesDuplicateAlert(left: DesktopConnectionAlert, right: DesktopConnectionAlert): boolean {
    if (left.metricKey !== right.metricKey || left.type !== right.type) {
      return false;
    }
    if (left.type === "renewed" && right.type === "renewed") {
      return true;
    }
    return left.type === "low-percent"
      && right.type === "low-percent"
      && left.thresholdPercent === right.thresholdPercent;
  }

  private createAlert(
    id: string,
    input: CreateConnectionAlertInput | UpdateConnectionAlertInput,
  ): DesktopConnectionAlert {
    const metricKey = this.normalizeMetricKey(input.metricKey);
    const metricLabel = this.readMetricLabel(input.metricLabel, metricKey);
    if (input.type === "renewed") {
      return {
        id,
        type: "renewed",
        metricKey,
        metricLabel,
        enabled: input.enabled,
      };
    }

    return {
      id,
      type: "low-percent",
      metricKey,
      metricLabel,
      thresholdPercent: this.normalizeThresholdPercent(input.thresholdPercent),
      enabled: input.enabled,
    };
  }

  private normalizeConnectionId(connectionId: string): string {
    const normalized = connectionId.trim();
    if (!normalized) {
      throw new Error("Connection alert connectionId is required");
    }
    return normalized;
  }

  private normalizeMetricKey(metricKey: string): string {
    const normalized = canonicalizeUsageMetricKey(metricKey);
    if (!normalized) {
      throw new Error("Connection alert metricKey is required");
    }
    return normalized;
  }

  private readMetricLabel(metricLabel: unknown, fallbackMetricKey: string): string {
    if (typeof metricLabel === "string" && metricLabel.trim()) {
      return metricLabel.trim();
    }
    return fallbackMetricKey;
  }

  private normalizeThresholdPercent(value: number): number {
    const next = Math.round(value);
    if (!Number.isFinite(next) || next < 1 || next > 100) {
      throw new Error(`Connection alert thresholdPercent must be between 1 and 100: ${value}`);
    }
    return next;
  }

  private readSortOrder(alert: DesktopConnectionAlert): number {
    return alert.type === "low-percent" ? 0 : 1;
  }

  private cloneAlertsByConnectionId(alertsByConnectionId: Map<string, DesktopConnectionAlert[]>): Map<string, DesktopConnectionAlert[]> {
    return new Map(
      [...alertsByConnectionId.entries()].map(([connectionId, alerts]) => [
        connectionId,
        alerts.map((alert) => ({ ...alert })),
      ]),
    );
  }
}
