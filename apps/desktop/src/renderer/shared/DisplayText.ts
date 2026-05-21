import type {
  DesktopConnection,
  DesktopHistoryEntry,
  DesktopOnboardingState,
} from "../../state/Types";
import type { Translator } from "./I18n";
import {
  resolveDesktopUsageSummary,
  type DesktopUsageState,
} from "../../state/UsageSummary";
import { formatOpenClawLiveIssue } from "./OpenClawIssueFormatter";
import { formatDesktopOptionalTimestamp, formatDesktopTimestamp } from "./TimeFormatter";

export function formatUsageText(
  connection: DesktopConnection | null | undefined,
  t: Translator,
  preferredMetricKey?: string | null,
): string {
  return formatUsageValue(connection?.usage, t, preferredMetricKey);
}

export function formatUsageValue(
  usage: DesktopUsageState | null | undefined,
  t: Translator,
  preferredMetricKey?: string | null,
): string {
  if (!usage) {
    return t("common.unknown");
  }
  if (usage.status !== "available") {
    return t("common.unknown");
  }
  return resolveDesktopUsageSummary(usage, preferredMetricKey)?.text ?? usage.text;
}

export function formatLiveIssue(issue: string, t: Translator): string {
  return formatOpenClawLiveIssue(issue, t);
}

export function formatConnectionSummary(connection: DesktopConnection | null, t: Translator): string {
  if (!connection) {
    return t("support.noSavedSelection");
  }

  return `${connection.label} · ${connection.endpointLabel}`;
}

export function formatOnboardingSummary(onboarding: DesktopOnboardingState | null, t: Translator): string {
  if (!onboarding) {
    return t("support.noLocalImportsPending");
  }

  if (onboarding.importableCount === 0) {
    return t("support.noImportableLocalSetups");
  }

  return t("support.importableLocalSetups", {
    count: onboarding.importableCount,
    suffix: onboarding.importableCount === 1 ? "" : "s",
  });
}

export function authModeLabel(authMode: string, t: Translator): string {
  switch (authMode) {
    case "api_key":
      return t("auth.api_key");
    case "openai_session":
      return t("auth.openai_session");
    case "openclaw_openai_session":
      return t("auth.openclaw_openai_session");
    case "claude_session":
      return t("auth.claude_session");
    case "cursor_session":
      return t("auth.cursor_session");
    case "gemini_cli_session":
      return t("auth.gemini_cli_session");
    default:
      return authMode;
  }
}

export function formatHistoryTimestamp(timestamp: string | null): string {
  return formatDesktopTimestamp(timestamp);
}

export function formatUsageResetAt(timestamp: string | null): string | null {
  return formatDesktopOptionalTimestamp(timestamp);
}

export function formatHistoryStatus(status: DesktopHistoryEntry["status"], t: Translator): string {
  switch (status) {
    case "failed":
      return t("history.failed");
    case "started":
      return t("history.started");
    case "rolled_back":
      return t("history.rolledBack");
    case "applied":
    default:
      return t("history.applied");
  }
}

export function formatHistoryType(type: DesktopHistoryEntry["type"], t: Translator): string {
  switch (type) {
    case "rollback_latest":
      return t("history.type.rollbackLatest");
    case "apply_selection":
    default:
      return t("history.type.applySelection");
  }
}
