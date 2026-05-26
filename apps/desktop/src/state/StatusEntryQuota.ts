import type { DesktopStatusEntryAgentState } from "./Types";
import {
  readConnectionQuotaMetricPreference,
  type ConnectionQuotaMetricPreferences,
} from "./ConnectionQuotaMetricPreferences";
import { resolveDesktopUsageSummary } from "./UsageSummary";

export function readStatusEntryAgentQuotaText(
  agent: DesktopStatusEntryAgentState,
  connectionQuotaMetricPreferences: ConnectionQuotaMetricPreferences = {},
): string | null {
  const summary = readStatusEntryAgentUsageSummary(agent, connectionQuotaMetricPreferences);
  return summary?.text ?? null;
}

export function readStatusEntryAgentBadgeText(
  agent: DesktopStatusEntryAgentState,
  connectionQuotaMetricPreferences: ConnectionQuotaMetricPreferences = {},
): string | null {
  const summary = readStatusEntryAgentUsageSummary(agent, connectionQuotaMetricPreferences);
  return summary ? `${summary.label} ${summary.remainingPercent}%` : null;
}

export function readStatusEntryAgentSummaryText(
  agent: DesktopStatusEntryAgentState,
  connectionQuotaMetricPreferences: ConnectionQuotaMetricPreferences = {},
): string | null {
  const summary = readStatusEntryAgentUsageSummary(agent, connectionQuotaMetricPreferences);
  return summary ? `${agent.agentLabel} ${summary.remainingPercent}%` : null;
}

function readStatusEntryAgentUsageSummary(
  agent: DesktopStatusEntryAgentState,
  connectionQuotaMetricPreferences: ConnectionQuotaMetricPreferences,
) {
  if (!agent.currentConnection || agent.currentUsage?.status !== "available") {
    return null;
  }

  return resolveDesktopUsageSummary(
    agent.currentUsage,
    readConnectionQuotaMetricPreference(
      connectionQuotaMetricPreferences,
      agent.currentConnection.id,
    ),
  );
}
