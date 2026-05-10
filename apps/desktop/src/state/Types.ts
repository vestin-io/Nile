import type { AgentId } from "@nile/core/models/agent/types";
import type { AuthMode } from "@nile/core/models/access";
import type { EndpointFamily } from "@nile/core/models/endpoint";
import type { DesktopUsageState } from "./UsageSummary";

export type DesktopConnectionAlertMetric = {
  key: string;
  label: string;
  remainingPercent: number;
  resetsAt?: string | null;
};

export type DesktopLowPercentConnectionAlert = {
  id: string;
  type: "low-percent";
  metricKey: string;
  metricLabel: string;
  thresholdPercent: number;
  enabled: boolean;
};

export type DesktopRenewedConnectionAlert = {
  id: string;
  type: "renewed";
  metricKey: string;
  metricLabel: string;
  enabled: boolean;
};

export type DesktopConnectionAlert = DesktopLowPercentConnectionAlert | DesktopRenewedConnectionAlert;

export type DesktopNotificationHistoryEntry = {
  id: string;
  shownAt: string;
  readAt: string | null;
  clickedAt: string | null;
  resetAt: string | null;
  title: string;
  body: string;
  kind: "action-required" | "profile-rule-suggestion" | "usage-threshold" | "usage-renewed";
  scope: "connection" | "agent" | "profile";
  subjectId: string | null;
  subjectLabel: string | null;
  targetPage: "settings" | "profiles" | "connections" | "agents" | "notifications" | null;
  targetConnectionId: string | null;
  targetAgentId: AgentId | null;
  targetProfileId: string | null;
};

export type DesktopNotificationHistoryConnection = {
  connectionId: string;
  label: string;
};

export type DesktopConnection = {
  id: string;
  label: string;
  endpointUrl?: string | null;
  endpointLabel: string;
  endpointFamily: EndpointFamily | "unknown";
  authMode: AuthMode | "unknown";
  apiKeySource?: "direct" | "env_key";
  envKey?: string | null;
  isCurrent: boolean;
  appliedAt?: string;
  usage?: DesktopUsageState | null;
  alertMetrics?: DesktopConnectionAlertMetric[];
  alerts?: DesktopConnectionAlert[];
  activeAlertCount: number;
  enabledAgents: AgentId[];
  configurableAgents: AgentId[];
  selectedByAgents: AgentId[];
};

export type DesktopSyncState =
  | "synced"
  | "new_connection_detected"
  | "invalid_live_state"
  | "unverified_live_state";

export type DesktopCurrentConnectionState = "none" | "saved" | "orphaned";

export type MenubarAgentState = {
  agentId: AgentId;
  agentLabel: string;
  currentConnection: DesktopConnection | null;
  currentUsage: DesktopUsageState | null;
  connections: DesktopConnection[];
};

export type MenubarState = {
  agents: MenubarAgentState[];
};

export type DesktopOnboardingItem = {
  scanId: AgentId;
  agentId: AgentId;
  title: string;
  subtitle: string;
  state: "new" | "already_saved" | "invalid" | "unsupported" | "unavailable";
  importable: boolean;
  defaultSelected: boolean;
  matchedConnectionLabel?: string;
  issues: string[];
};

export type DesktopOnboardingState = {
  mode: "single" | "multi" | "empty";
  importableCount: number;
  items: DesktopOnboardingItem[];
};

export type DesktopAgentState = {
  agentId: AgentId;
  agentLabel: string;
  canRollback: boolean;
  latestRollbackableMutationId: string | null;
  currentConnection: DesktopConnection | null;
  currentUsage: DesktopUsageState | null;
  currentConnectionState: DesktopCurrentConnectionState;
  liveConnection: DesktopConnection | null;
  syncState: DesktopSyncState;
  liveIssues?: string[];
  connections: DesktopConnection[];
};

export type DesktopAdvancedState = {
  agentHomes: Array<{
    agentId: AgentId;
    agentLabel: string;
    path: string;
    defaultPath: string;
  }>;
  supportedAgents: Array<{
    agentId: AgentId;
    agentLabel: string;
  }>;
  savedConnectionCount: number;
  importableSetupCount: number;
};

export type DesktopCurrentStateSection = {
  currentConnection: DesktopConnection | null;
  currentConnectionState: DesktopCurrentConnectionState;
  liveConnection: DesktopConnection | null;
  syncState: DesktopSyncState;
  liveIssues?: string[];
};

export type DesktopConnectionsSection = {
  connections: DesktopConnection[];
  currentAgentConnections: DesktopConnection[];
};

export type DesktopUpdateAvailability = "available" | "development" | "unsupported_platform";
export type DesktopReleaseStatus = "idle" | "checking" | "no_update" | "ready";

export type DesktopReleaseInfo = {
  version: string;
  updateAvailability: DesktopUpdateAvailability;
  status: DesktopReleaseStatus;
  availableVersion: string | null;
};

export type DesktopUpdateCheckResult = {
  status: "started" | "unavailable";
};

export type DesktopInstallUpdateResult = {
  status: "started" | "unavailable";
};

export type SettingsState = DesktopCurrentStateSection & DesktopConnectionsSection & {
  onboarding: DesktopOnboardingState | null;
  agents: DesktopAgentState[];
  detectedSetups: DesktopOnboardingState;
  advanced: DesktopAdvancedState;
};

export type DesktopHistoryEntry = {
  id: string;
  agentId: AgentId;
  agentLabel: string;
  type: string;
  status: string;
  connectionId: string;
  connectionLabel: string;
  endpointLabel: string;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  fileCount: number;
};

export type DesktopHistoryAgentState = {
  agentId: AgentId;
  agentLabel: string;
  canRollback: boolean;
  latestRollbackableMutationId: string | null;
};

export type HistoryState = {
  agents: DesktopHistoryAgentState[];
  entries: DesktopHistoryEntry[];
};
