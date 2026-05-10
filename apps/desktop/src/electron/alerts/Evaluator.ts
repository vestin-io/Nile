import type { SettingsState, DesktopConnectionAlert, DesktopConnectionAlertMetric } from "../../state/Types";
import type { DesktopNotificationIntent } from "../notifications/Types";

type ConnectionUsageAlertEvaluatorOptions = {
  notify(intent: DesktopNotificationIntent): void;
};

type MetricObservation = {
  remainingPercent: number;
  resetsAt: string | null;
};

export class ConnectionUsageAlertEvaluator {
  private readonly lastObservationByMetric = new Map<string, MetricObservation>();

  constructor(private readonly options: ConnectionUsageAlertEvaluatorOptions) {}

  evaluate(state: SettingsState): void {
    const activeMetricKeys = new Set<string>();
    for (const connection of state.connections) {
      const enabledAlerts = (connection.alerts ?? []).filter((alert) => alert.enabled);
      if (enabledAlerts.length === 0) {
        continue;
      }

      const metricByKey = new Map((connection.alertMetrics ?? []).map((metric) => [metric.key, metric]));
      for (const [metricKey, metricAlerts] of this.groupAlertsByMetric(enabledAlerts)) {
        const metric = metricByKey.get(metricKey);
        if (!metric) {
          continue;
        }

        activeMetricKeys.add(this.readMetricStateKey(connection.id, metric.key));
        this.evaluateMetric(connection.id, connection.label, metric, metricAlerts);
      }
    }

    for (const metricStateKey of this.lastObservationByMetric.keys()) {
      if (!activeMetricKeys.has(metricStateKey)) {
        this.lastObservationByMetric.delete(metricStateKey);
      }
    }
  }

  private evaluateMetric(
    connectionId: string,
    connectionLabel: string,
    metric: DesktopConnectionAlertMetric,
    alerts: DesktopConnectionAlert[],
  ): void {
    const metricStateKey = this.readMetricStateKey(connectionId, metric.key);
    const previousObservation = this.lastObservationByMetric.get(metricStateKey);
    this.lastObservationByMetric.set(metricStateKey, {
      remainingPercent: metric.remainingPercent,
      resetsAt: metric.resetsAt ?? null,
    });

    if (!previousObservation) {
      return;
    }

    const crossedAlerts = alerts
      .filter((alert): alert is Extract<DesktopConnectionAlert, { type: "low-percent" }> => alert.type === "low-percent")
      .filter((alert) =>
        previousObservation.remainingPercent >= alert.thresholdPercent
        && metric.remainingPercent < alert.thresholdPercent)
      .sort((left, right) => left.thresholdPercent - right.thresholdPercent);
    const nextAlert = crossedAlerts[0];
    if (nextAlert) {
      this.options.notify({
        id: `usage-threshold:${connectionId}:${metric.key}:${nextAlert.id}:${metric.remainingPercent}`,
        title: `${connectionLabel} quota is running low`,
        body: `${metric.label} is down to ${metric.remainingPercent}% remaining, below your ${nextAlert.thresholdPercent}% alert.`,
        kind: "usage-threshold",
        scope: "connection",
        resetAt: metric.resetsAt ?? null,
        subject: {
          id: connectionId,
          label: connectionLabel,
        },
        target: { page: "connections", connectionId },
        dedupeKey: `usage-threshold:${connectionId}:${metric.key}:${nextAlert.id}`,
        cooldownMs: 60_000,
      });
    }

    const renewedAlert = alerts.find((alert): alert is Extract<DesktopConnectionAlert, { type: "renewed" }> =>
      alert.type === "renewed" && this.wasRenewed(previousObservation, metric));
    if (!renewedAlert) {
      return;
    }

    this.options.notify({
      id: `usage-renewed:${connectionId}:${metric.key}:${renewedAlert.id}:${metric.resetsAt ?? metric.remainingPercent}`,
      title: `${connectionLabel} quota has renewed`,
      body: `${metric.label} is back to ${metric.remainingPercent}% remaining.`,
      kind: "usage-renewed",
      scope: "connection",
      resetAt: metric.resetsAt ?? null,
      subject: {
        id: connectionId,
        label: connectionLabel,
      },
      target: { page: "connections", connectionId },
      dedupeKey: `usage-renewed:${connectionId}:${metric.key}:${renewedAlert.id}`,
      cooldownMs: 60_000,
    });
  }

  private readMetricStateKey(connectionId: string, metricKey: string): string {
    return `${connectionId}:${metricKey}`;
  }

  private groupAlertsByMetric(alerts: DesktopConnectionAlert[]): Map<string, DesktopConnectionAlert[]> {
    const result = new Map<string, DesktopConnectionAlert[]>();
    for (const alert of alerts) {
      const current = result.get(alert.metricKey) ?? [];
      current.push(alert);
      result.set(alert.metricKey, current);
    }
    return result;
  }

  private wasRenewed(previous: MetricObservation, current: DesktopConnectionAlertMetric): boolean {
    const currentResetsAt = current.resetsAt ?? null;
    return previous.resetsAt !== null
      && currentResetsAt !== null
      && previous.resetsAt !== currentResetsAt
      && current.remainingPercent > previous.remainingPercent;
  }
}
