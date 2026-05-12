import type { DesktopConnectionAlert } from "../../state/Types";
import { canonicalizeUsageMetricKey } from "../../state/UsageSummary";
import type { CreateConnectionAlertInput, UpdateConnectionAlertInput } from "./Store";

export type ConnectionAlertRow = {
  id: string;
  connection_id: string;
  metric_key: string;
  metric_label: string;
  type: string;
  threshold_percent: number | null;
  enabled: number;
};

export class ConnectionAlertCodec {
  readDatabaseAlert(row: ConnectionAlertRow): DesktopConnectionAlert | null {
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

  readAlerts(value: unknown): DesktopConnectionAlert[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const alerts = value.flatMap((entry) => this.readLegacyAlert(entry));
    return this.sortAlerts(alerts);
  }

  createAlert(
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

  sortAlerts(alerts: DesktopConnectionAlert[]): DesktopConnectionAlert[] {
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

  assertAlertAvailable(
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

  normalizeConnectionId(connectionId: string): string {
    const normalized = connectionId.trim();
    if (!normalized) {
      throw new Error("Connection alert connectionId is required");
    }
    return normalized;
  }

  cloneAlertsByConnectionId(alertsByConnectionId: Map<string, DesktopConnectionAlert[]>): Map<string, DesktopConnectionAlert[]> {
    return new Map(
      [...alertsByConnectionId.entries()].map(([connectionId, alerts]) => [
        connectionId,
        alerts.map((alert) => ({ ...alert })),
      ]),
    );
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
}
