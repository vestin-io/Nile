import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import type { Translator } from "../../shared/I18n";
import type { DesktopConnectionAlert, DesktopConnectionAlertMetric } from "../../../state/Types";

type ConnectionAlertDialogSubmitInput =
  | {
    metricKey: string;
    metricLabel: string;
    type: "low-percent";
    thresholdPercent: number;
    enabled: boolean;
  }
  | {
    metricKey: string;
    metricLabel: string;
    type: "renewed";
    enabled: boolean;
  };

type ConnectionAlertDialogProps = {
  availableMetrics: DesktopConnectionAlertMetric[];
  editingAlert: DesktopConnectionAlert | null;
  error: string | null;
  open: boolean;
  t: Translator;
  onOpenChange(open: boolean): void;
  onSubmit(input: ConnectionAlertDialogSubmitInput): Promise<void>;
};

export function ConnectionAlertDialog({
  availableMetrics,
  editingAlert,
  error,
  open,
  t,
  onOpenChange,
  onSubmit,
}: ConnectionAlertDialogProps) {
  const [enabled, setEnabled] = useState(true);
  const [metricKey, setMetricKey] = useState("");
  const [alertType, setAlertType] = useState<DesktopConnectionAlert["type"]>("low-percent");
  const [thresholdText, setThresholdText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const fallbackMetricKey = availableMetrics[0]?.key ?? "";
    setMetricKey(editingAlert?.metricKey ?? fallbackMetricKey);
    setAlertType(editingAlert?.type ?? "low-percent");
    setThresholdText(editingAlert?.type === "low-percent" ? String(editingAlert.thresholdPercent) : "");
    setEnabled(editingAlert?.enabled ?? true);
    setIsSaving(false);
  }, [availableMetrics, editingAlert, open]);

  const metricOptions = mergeMetricOptions(availableMetrics, editingAlert);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-7">
        <DialogHeader className="space-y-2">
          <DialogTitle>{editingAlert ? t("connections.alerts.editTitle") : t("connections.alerts.addTitle")}</DialogTitle>
          <DialogDescription>{t("connections.alerts.dialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="connection-alert-metric">{t("connections.alerts.metricColumn")}</Label>
            <Select value={metricKey} onValueChange={setMetricKey}>
              <SelectTrigger id="connection-alert-metric" disabled={metricOptions.length === 0}>
                <SelectValue placeholder={t("connections.alerts.metricPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {metricOptions.map((metric) => (
                  <SelectItem key={metric.key} value={metric.key}>
                    {metric.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="connection-alert-type">{t("connections.alerts.typeColumn")}</Label>
            <Select value={alertType} onValueChange={(value: DesktopConnectionAlert["type"]) => setAlertType(value)}>
              <SelectTrigger id="connection-alert-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low-percent">{t("connections.alerts.typeLowPercent")}</SelectItem>
                <SelectItem value="renewed">{t("connections.alerts.typeRenewed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {alertType === "low-percent" ? (
            <div className="space-y-2">
              <Label htmlFor="connection-alert-threshold">{t("connections.alerts.thresholdLabel")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="connection-alert-threshold"
                  inputMode="numeric"
                  max={100}
                  min={1}
                  type="number"
                  value={thresholdText}
                  onChange={(event) => setThresholdText(event.target.value)}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
              {t("connections.alerts.renewedDescription")}
            </div>
          )}

          <label className="flex items-center gap-3 text-sm">
            <Checkbox checked={enabled} onCheckedChange={(checked) => setEnabled(checked === true)} />
            <span>{t("connections.alerts.enabledLabel")}</span>
          </label>

          {error ? <div className="text-sm text-destructive">{error}</div> : null}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={isSaving || !metricKey.trim() || (alertType === "low-percent" && !thresholdText.trim())}
            onClick={async () => {
              setIsSaving(true);
              try {
                const selectedMetricLabel =
                  metricOptions.find((option) => option.key === metricKey)?.label
                  ?? editingAlert?.metricLabel
                  ?? metricKey;
                await onSubmit(alertType === "renewed"
                  ? {
                    metricKey,
                    metricLabel: selectedMetricLabel,
                    type: "renewed",
                    enabled,
                  }
                  : {
                    metricKey,
                    metricLabel: selectedMetricLabel,
                    type: "low-percent",
                    thresholdPercent: Number(thresholdText),
                    enabled,
                  });
              } finally {
                setIsSaving(false);
              }
            }}
          >
            {isSaving ? t("connections.alerts.saving") : (editingAlert ? t("common.save") : t("connections.alerts.addAction"))}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function mergeMetricOptions(
  availableMetrics: DesktopConnectionAlertMetric[],
  editingAlert: DesktopConnectionAlert | null,
): Array<{ key: string; label: string }> {
  const options = new Map(availableMetrics.map((metric) => [metric.key, metric.label]));
  if (editingAlert && !options.has(editingAlert.metricKey)) {
    options.set(editingAlert.metricKey, editingAlert.metricLabel);
  }
  return [...options.entries()].map(([key, label]) => ({ key, label }));
}
