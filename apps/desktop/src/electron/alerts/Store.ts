import { randomUUID } from "node:crypto";

import type { DesktopConnectionAlert } from "../../state/Types";
import { SqliteDatabase } from "@nile/core/services/database";
import { ConnectionAlertCodec, type ConnectionAlertRow } from "./Codec";

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
  private readonly codec = new ConnectionAlertCodec();
  constructor(private readonly databasePath: string) {}

  list(connectionId: string): DesktopConnectionAlert[] {
    return this.readAlertsByConnectionId().get(this.codec.normalizeConnectionId(connectionId)) ?? [];
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
        const alertsByConnectionId = this.readAlertsByConnectionIdFromDatabase(database);
        const connectionId = this.codec.normalizeConnectionId(input.connectionId);
        const nextAlert = this.codec.createAlert(randomUUID(), input);
        const existingAlerts = alertsByConnectionId.get(connectionId) ?? [];
        this.codec.assertAlertAvailable(existingAlerts, nextAlert);
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
        const alertsByConnectionId = this.readAlertsByConnectionIdFromDatabase(database);
        const connectionId = this.codec.normalizeConnectionId(input.connectionId);
        const alerts = [...(alertsByConnectionId.get(connectionId) ?? [])];
        const alertIndex = alerts.findIndex((alert) => alert.id === input.alertId);
        if (alertIndex < 0) {
          throw new Error(`Connection alert not found: ${input.alertId}`);
        }

        const updatedAlert = this.codec.createAlert(alerts[alertIndex].id, input);
        this.codec.assertAlertAvailable(alerts, updatedAlert, updatedAlert.id);
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
        const deleted = database
          .query<{ id: string }>("SELECT id FROM desktop_connection_alerts WHERE connection_id = ? AND id = ?")
          .get(this.codec.normalizeConnectionId(connectionId), alertId);
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
      return this.codec.cloneAlertsByConnectionId(this.cachedAlertsByConnectionId);
    }

    const database = SqliteDatabase.open(this.databasePath);
    try {
      this.initialize(database);
      const result = this.readAlertsByConnectionIdFromDatabase(database);
      this.cachedAlertsByConnectionId = this.codec.cloneAlertsByConnectionId(result);
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
      const alert = this.codec.readDatabaseAlert(row);
      if (!alert) {
        continue;
      }
      const connectionId = this.codec.normalizeConnectionId(row.connection_id);
      const current = alertsByConnectionId.get(connectionId) ?? [];
      current.push(alert);
      alertsByConnectionId.set(connectionId, current);
    }

    for (const [connectionId, alerts] of alertsByConnectionId.entries()) {
      alertsByConnectionId.set(connectionId, this.codec.sortAlerts(alerts));
    }
    return alertsByConnectionId;
  }
}
