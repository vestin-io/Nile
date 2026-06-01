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
  errorCode?: "credential_unauthorized";
  planLabel?: string;
  freshness?: "live" | "cached" | "stale" | "expired";
  lastFetchedAt?: string;
  message?: string;
  windows: [];
  text: string;
};

export type DesktopUsageState = DesktopAvailableUsage | DesktopUnavailableUsage;

export type DesktopResolvedUsageSummary = {
  key: string;
  label: string;
  remainingPercent: number;
  text: string;
};

type UsageInput = {
  endpointFamily: string;
  errorCode?: "credential_unauthorized";
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
      if (result.endpointFamily !== "cursor" && result.errorCode !== "credential_unauthorized") {
        return null;
      }
      return {
        status: result.status as DesktopUnavailableUsage["status"],
        errorCode: result.errorCode,
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

    const resolved = resolveDesktopUsageSummary({
      status: "available",
      planLabel: result.planLabel,
      freshness: result.freshness,
      windows,
      windowLabel: windows[0].label,
      remainingPercent: windows[0].remainingPercent,
      text: "",
    });
    if (!resolved) {
      return null;
    }

    return {
      status: "available",
      planLabel: result.planLabel,
      freshness: result.freshness,
      windows,
      windowLabel: resolved.label,
      remainingPercent: resolved.remainingPercent,
      text: resolved.text,
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

export function resolveDesktopUsageSummary(
  usage: DesktopUsageState | null | undefined,
  preferredMetricKey?: string | null,
): DesktopResolvedUsageSummary | null {
  if (!usage || usage.status !== "available" || usage.windows.length === 0) {
    return null;
  }

  const preferredWindow = preferredMetricKey
    ? usage.windows.find((window) => window.key === preferredMetricKey)
    : null;
  const selectedWindow = preferredWindow ?? usage.windows.reduce((lowest, current) =>
    current.remainingPercent < lowest.remainingPercent ? current : lowest,
  );

  return {
    key: selectedWindow.key,
    label: selectedWindow.label,
    remainingPercent: selectedWindow.remainingPercent,
    text: usage.freshness && usage.freshness !== "live"
      ? `${selectedWindow.label} ${selectedWindow.remainingPercent}% left (${usage.freshness})`
      : `${selectedWindow.label} ${selectedWindow.remainingPercent}% left`,
  };
}
