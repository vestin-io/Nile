import type {
  DesktopAgentState,
  DesktopHistoryEntry,
  DesktopConnection,
  DesktopOnboardingState,
} from "../../DesktopTypes";
import type { AgentId } from "@nile/core/models/agent/types";
import type { Translator } from "./I18n";
import type { DesktopUsageState } from "../../UsageSummary";

export type SettingsState = Awaited<ReturnType<typeof window.nileDesktop.getSettingsState>>;
export type HistoryState = Awaited<ReturnType<typeof window.nileDesktop.getHistoryState>>;
export type Definition = Awaited<ReturnType<typeof window.nileDesktop.listConnectionDefinitions>>[number];

export function canConfigureAgent(definitions: Definition[], agentId: AgentId): boolean {
  return definitions.some((definition) => definition.configurableAgents.includes(agentId));
}

export function readDefinitionsForAgent(definitions: Definition[], agentId: AgentId | null): Definition[] {
  if (!agentId) {
    return definitions;
  }

  const matchingDefinitions = definitions.filter((definition) => definition.configurableAgents.includes(agentId));
  return matchingDefinitions.length > 0 ? matchingDefinitions : definitions;
}

export function readDefinitionKeywords(definition: Definition): string[] {
  return [...new Set([definition.preset, definition.label, ...definition.configurableAgents])];
}

export function orderSupportedAuthModes(
  authModes: Definition["supportedAuthModes"],
): Definition["supportedAuthModes"] {
  return [...authModes].sort((left, right) => readAuthModePriority(left) - readAuthModePriority(right));
}

export function formatAgentLabel(agentId: string): string {
  if (agentId === "openclaw") {
    return "OpenClaw";
  }
  return agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

export function formatUsageText(connection: DesktopConnection | null | undefined, t: Translator): string {
  return formatUsageValue(connection?.usage, t);
}

export function formatUsageValue(usage: DesktopUsageState | null | undefined, t: Translator): string {
  if (!usage) {
    return t("common.unknown");
  }
  if (usage.status !== "available") {
    return t("common.unknown");
  }
  return usage.text;
}

export function formatLiveIssue(issue: string, t: Translator): string {
  const missingConfigMatch = issue.match(/^OpenClaw config not found at (.+)$/);
  if (missingConfigMatch) {
    return t("issues.openclaw.configNotFound", { path: missingConfigMatch[1] });
  }

  const emptyConfigMatch = issue.match(/^OpenClaw config is empty at (.+)$/);
  if (emptyConfigMatch) {
    return t("issues.openclaw.configEmpty", { path: emptyConfigMatch[1] });
  }

  if (issue === "OpenClaw config does not define agents.defaults.model.primary") {
    return t("issues.openclaw.primaryModelMissing");
  }

  if (issue === "OpenClaw config does not define models.providers") {
    return t("issues.openclaw.providersMissing");
  }

  const missingProviderMatch = issue.match(
    /^OpenClaw config does not contain provider (.+) referenced by agents\.defaults\.model\.primary$/,
  );
  if (missingProviderMatch) {
    return t("issues.openclaw.providerMissing", { provider: missingProviderMatch[1] });
  }

  const missingFieldMatch = issue.match(
    /^OpenClaw provider (.+) is missing (baseUrl|apiKey|api)$/,
  );
  if (missingFieldMatch) {
    return t("issues.openclaw.providerFieldMissing", {
      provider: missingFieldMatch[1],
      field: missingFieldMatch[2],
    });
  }

  const unsupportedProtocolMatch = issue.match(
    /^OpenClaw provider (.+) uses unsupported api protocol (.+)$/,
  );
  if (unsupportedProtocolMatch) {
    return t("issues.openclaw.unsupportedProtocol", {
      provider: unsupportedProtocolMatch[1],
      protocol: unsupportedProtocolMatch[2],
    });
  }

  const invalidPrimaryMatch = issue.match(
    /^OpenClaw primary model must use provider\/model format, received: (.+)$/,
  );
  if (invalidPrimaryMatch) {
    return t("issues.openclaw.invalidPrimaryModel", { value: invalidPrimaryMatch[1] });
  }

  return issue;
}

export function formatConnectionSummary(connection: DesktopConnection | null, t: Translator): string {
  if (!connection) {
    return t("support.noSavedSelection");
  }

  return `${connection.label} · ${connection.endpointLabel}`;
}

export function formatSyncLabel(syncState: DesktopAgentState["syncState"], t: Translator): string {
  switch (syncState) {
    case "synced":
      return t("sync.synced");
    case "new_connection_detected":
      return t("sync.new_connection_detected");
    case "invalid_live_state":
      return t("sync.invalid_live_state");
    case "unverified_live_state":
      return t("sync.unverified_live_state");
  }
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

export function formatAgentsList(agentIds: string[], t: Translator): string {
  if (agentIds.length === 0) {
    return t("common.none");
  }

  return agentIds.map(formatAgentLabel).join(", ");
}

export function authModeLabel(authMode: string, t: Translator): string {
  switch (authMode) {
    case "api_key":
      return t("auth.api_key");
    case "openai_session":
      return t("auth.openai_session");
    case "claude_session":
      return t("auth.claude_session");
    case "cursor_session":
      return t("auth.cursor_session");
    default:
      return authMode;
  }
}

export function sameAgentSelection(
  left: AgentId[],
  right: AgentId[],
): boolean {
  return left.length === right.length && left.every((agentId, index) => agentId === right[index]);
}

function readAuthModePriority(authMode: Definition["supportedAuthModes"][number]): number {
  switch (authMode) {
    case "openai_session":
    case "claude_session":
    case "cursor_session":
      return 0;
    case "api_key":
    default:
      return 1;
  }
}

export function formatHistoryTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function formatUsageResetAt(timestamp: string | null): string | null {
  if (!timestamp) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
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
