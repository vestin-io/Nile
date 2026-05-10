import { useMemo, useState } from "react";
import { Bell, BellPlus, History, Pencil, Trash2 } from "lucide-react";

import type { DesktopConnectionAlert, DesktopConnectionAlertMetric } from "../../../state/Types";
import type { Translator } from "../../shared/I18n";
import { Button } from "../../ui/button";
import { Switch } from "../../ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { ConnectionAlertDialog } from "./Dialog";

type ConnectionAlertsSectionProps = {
  alerts: DesktopConnectionAlert[];
  connectionId: string;
  metrics: DesktopConnectionAlertMetric[];
  t: Translator;
  onCreateAlert(input:
    | { connectionId: string; metricKey: string; metricLabel: string; type: "low-percent"; thresholdPercent: number; enabled: boolean }
    | { connectionId: string; metricKey: string; metricLabel: string; type: "renewed"; enabled: boolean }
  ): Promise<void>;
  onDeleteAlert(connectionId: string, alertId: string): Promise<void>;
  onOpenHistory?(): void;
  onUpdateAlert(input:
    | { alertId: string; connectionId: string; metricKey: string; metricLabel: string; type: "low-percent"; thresholdPercent: number; enabled: boolean }
    | { alertId: string; connectionId: string; metricKey: string; metricLabel: string; type: "renewed"; enabled: boolean }
  ): Promise<void>;
};

export function ConnectionAlertsSection({
  alerts,
  connectionId,
  metrics,
  t,
  onCreateAlert,
  onDeleteAlert,
  onOpenHistory,
  onUpdateAlert,
}: ConnectionAlertsSectionProps) {
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [editingAlert, setEditingAlert] = useState<DesktopConnectionAlert | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [removingAlertId, setRemovingAlertId] = useState<string | null>(null);
  const [updatingAlertId, setUpdatingAlertId] = useState<string | null>(null);

  const sortedAlerts = useMemo(() => {
    const labelsByMetricKey = new Map(metrics.map((metric) => [metric.key, metric.label]));
    return [...alerts].sort((left, right) => {
      const metricCompare = (labelsByMetricKey.get(left.metricKey) ?? left.metricLabel)
        .localeCompare(labelsByMetricKey.get(right.metricKey) ?? right.metricLabel);
      if (metricCompare !== 0) {
        return metricCompare;
      }
      if (left.type !== right.type) {
        return left.type === "low-percent" ? -1 : 1;
      }
      if (left.type === "low-percent" && right.type === "low-percent") {
        return right.thresholdPercent - left.thresholdPercent;
      }
      return left.id.localeCompare(right.id);
    });
  }, [alerts, metrics]);

  return (
    <section className="space-y-4 rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Bell className="h-3.5 w-3.5" />
            {t("common.alerts")}
          </div>
          <div className="text-sm text-muted-foreground">
            {t("connections.alerts.description")}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onOpenHistory ? (
            <Button
              aria-label={t("connections.alerts.viewHistory")}
              className="h-10 w-10 px-0"
              variant="outline"
              onClick={onOpenHistory}
            >
              <History className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            aria-label={t("connections.alerts.addAction")}
            className="h-10 w-10 px-0"
            variant="outline"
            disabled={metrics.length === 0}
            onClick={() => {
              setDialogError(null);
              setEditingAlert(null);
              setIsDialogOpen(true);
            }}
          >
            <BellPlus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {metrics.length === 0 && sortedAlerts.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
          {t("connections.alerts.unavailable")}
        </div>
      ) : sortedAlerts.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
          {t("connections.alerts.empty")}
        </div>
      ) : (
        <div className="space-y-3">
          {metrics.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
              {t("connections.alerts.unavailable")}
            </div>
          ) : null}
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("connections.alerts.metricColumn")}</TableHead>
                  <TableHead>{t("connections.alerts.triggerColumn")}</TableHead>
                  <TableHead>{t("connections.alerts.statusColumn")}</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAlerts.map((alert) => {
                  return (
                    <TableRow key={alert.id}>
                      <TableCell className="font-medium">{readMetricLabel(metrics, alert)}</TableCell>
                      <TableCell>{readAlertTriggerLabel(alert, t)}</TableCell>
                      <TableCell>
                        <Switch
                          aria-label={t("connections.alerts.enabledLabel")}
                          checked={alert.enabled}
                          disabled={updatingAlertId === alert.id}
                          onCheckedChange={async (checked) => {
                            setUpdatingAlertId(alert.id);
                            try {
                              await onUpdateAlert(alert.type === "renewed"
                                ? {
                                  alertId: alert.id,
                                  connectionId,
                                  metricKey: alert.metricKey,
                                  metricLabel: alert.metricLabel,
                                  type: "renewed",
                                  enabled: checked === true,
                                }
                                : {
                                  alertId: alert.id,
                                  connectionId,
                                  metricKey: alert.metricKey,
                                  metricLabel: alert.metricLabel,
                                  type: "low-percent",
                                  thresholdPercent: alert.thresholdPercent,
                                  enabled: checked === true,
                                });
                            } finally {
                              setUpdatingAlertId(null);
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="w-[1%] whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            aria-label={t("common.edit")}
                            className="h-9 w-9 px-0"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setDialogError(null);
                              setEditingAlert(alert);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            aria-label={t("common.remove")}
                            className="h-9 w-9 px-0"
                            size="sm"
                            variant="ghost"
                            disabled={removingAlertId === alert.id}
                            onClick={async () => {
                              setRemovingAlertId(alert.id);
                              try {
                                await onDeleteAlert(connectionId, alert.id);
                              } finally {
                                setRemovingAlertId(null);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <ConnectionAlertDialog
        availableMetrics={metrics}
        editingAlert={editingAlert}
        error={dialogError}
        open={isDialogOpen}
        t={t}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingAlert(null);
            setDialogError(null);
          }
        }}
        onSubmit={async (input) => {
          try {
            if (editingAlert) {
              await onUpdateAlert({
                alertId: editingAlert.id,
                connectionId,
                ...input,
              });
            } else {
              await onCreateAlert({
                connectionId,
                ...input,
              });
            }
            setIsDialogOpen(false);
            setEditingAlert(null);
            setDialogError(null);
          } catch (error) {
            setDialogError(error instanceof Error ? error.message : String(error));
          }
        }}
      />
    </section>
  );
}

function readAlertTriggerLabel(alert: DesktopConnectionAlert, t: Translator): string {
  return alert.type === "renewed"
    ? t("connections.alerts.renewedCondition")
    : t("connections.alerts.thresholdTriggerValue", { percent: String(alert.thresholdPercent) });
}

function readMetricLabel(metrics: DesktopConnectionAlertMetric[], alert: DesktopConnectionAlert): string {
  return metrics.find((entry) => entry.key === alert.metricKey)?.label ?? alert.metricLabel;
}
