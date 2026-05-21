export type ConnectionQuotaMetricPreferences = Record<string, string>;

export function normalizeConnectionQuotaMetricPreferences(value: unknown): ConnectionQuotaMetricPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: ConnectionQuotaMetricPreferences = {};
  for (const [connectionId, metricKey] of Object.entries(value)) {
    const normalizedConnectionId = connectionId.trim();
    const normalizedMetricKey = typeof metricKey === "string" ? metricKey.trim() : "";
    if (!normalizedConnectionId || !normalizedMetricKey) {
      continue;
    }
    result[normalizedConnectionId] = normalizedMetricKey;
  }
  return result;
}

export function parseConnectionQuotaMetricPreferencesFromDesktopPreferences(
  raw: string | null,
): ConnectionQuotaMetricPreferences {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as { connectionQuotaMetricPreferences?: unknown };
    return normalizeConnectionQuotaMetricPreferences(parsed.connectionQuotaMetricPreferences);
  } catch {
    return {};
  }
}

export function readConnectionQuotaMetricPreference(
  preferences: ConnectionQuotaMetricPreferences,
  connectionId: string,
): string | null {
  const normalizedConnectionId = connectionId.trim();
  if (!normalizedConnectionId) {
    return null;
  }
  return preferences[normalizedConnectionId] ?? null;
}

export function writeConnectionQuotaMetricPreference(
  preferences: ConnectionQuotaMetricPreferences,
  connectionId: string,
  metricKey: string | null,
): ConnectionQuotaMetricPreferences {
  const normalizedConnectionId = connectionId.trim();
  if (!normalizedConnectionId) {
    return preferences;
  }

  const next = { ...preferences };
  const normalizedMetricKey = metricKey?.trim() ?? "";
  if (!normalizedMetricKey) {
    delete next[normalizedConnectionId];
    return next;
  }

  next[normalizedConnectionId] = normalizedMetricKey;
  return next;
}
