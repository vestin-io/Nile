export type DesktopUsageWindowSummary = {
  key: string;
  label: string;
  remainingPercent: number;
  resetsAt?: string | null;
};

export type DesktopAvailableUsage = {
  status: "available";
  planLabel?: string;
  freshness?: "live" | "cached" | "stale" | "expired";
  windows: DesktopUsageWindowSummary[];
  windowLabel: string;
  remainingPercent: number;
  text: string;
};

export type DesktopUnavailableUsage = {
  status: "unavailable" | "unsupported" | "error";
  planLabel?: string;
  freshness?: "live" | "cached" | "stale" | "expired";
  lastFetchedAt?: string;
  message?: string;
  windows: [];
  text: string;
};

export type DesktopUsageState = DesktopAvailableUsage | DesktopUnavailableUsage;

type UsageInput = {
  endpointFamily: string;
  planLabel?: string;
  status: string;
  freshness?: "live" | "cached" | "stale" | "expired";
  lastFetchedAt?: string;
  message?: string;
  windows: Array<{
    label: string;
    remainingPercent: number | null;
    resetsAt?: string | null;
  }>;
};

export function canonicalizeUsageMetricKey(label: string): string {
  const normalized = label.trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  if (
    normalized === "7d"
    || normalized === "weekly"
    || normalized === "seven day"
    || normalized === "seven-day"
  ) {
    return "weekly";
  }
  return normalized.replace(/\s+/g, "-");
}

export class UsageSummary {
  static fromResult(result: UsageInput): DesktopUsageState | null {
    if (result.status !== "available") {
      if (result.endpointFamily !== "cursor") {
        return null;
      }
      return {
        status: result.status as DesktopUnavailableUsage["status"],
        planLabel: result.planLabel,
        freshness: result.freshness,
        lastFetchedAt: result.lastFetchedAt,
        message: result.message,
        windows: [],
        text: result.message?.trim() || "Unavailable",
      };
    }

    const windows = result.windows.filter(
      (window): window is DesktopUsageWindowSummary =>
        typeof window.remainingPercent === "number",
    ).map((window) => ({
      key: canonicalizeUsageMetricKey(window.label),
      label: this.normalizeLabel(window.label),
      remainingPercent: Math.max(0, Math.min(100, Math.round(window.remainingPercent))),
      resetsAt: window.resetsAt ?? null,
    }));
    if (windows.length === 0) {
      return null;
    }

    const tightestWindow = windows.reduce((lowest, current) =>
      current.remainingPercent < lowest.remainingPercent ? current : lowest,
    );
    const windowLabel = tightestWindow.label;
    const remainingPercent = tightestWindow.remainingPercent;

    return {
      status: "available",
      planLabel: result.planLabel,
      freshness: result.freshness,
      windows,
      windowLabel,
      remainingPercent,
      text: result.freshness && result.freshness !== "live"
        ? `${windowLabel} ${remainingPercent}% left (${result.freshness})`
        : `${windowLabel} ${remainingPercent}% left`,
    };
  }

  private static normalizeLabel(label: string): string {
    const metricKey = canonicalizeUsageMetricKey(label);
    if (metricKey === "weekly") {
      return "weekly";
    }
    return label.trim();
  }
}
