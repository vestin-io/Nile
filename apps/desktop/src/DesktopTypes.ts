import type { AgentId } from "@nile/core/models/agent/types";
import type { EndpointFamily } from "@nile/core/models/endpoint";
import type { DesktopUsageState } from "./UsageSummary";

export type DesktopConnection = {
  id: string;
  label: string;
  endpointUrl?: string | null;
  endpointLabel: string;
  endpointFamily: EndpointFamily | "unknown";
  authMode: string;
  apiKeySource?: "direct" | "env_key";
  envKey?: string | null;
  isCurrent: boolean;
  appliedAt?: string;
  usage?: DesktopUsageState | null;
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

export type SettingsState = {
  onboarding: DesktopOnboardingState | null;
  currentConnection: DesktopConnection | null;
  currentConnectionState: DesktopCurrentConnectionState;
  liveConnection: DesktopConnection | null;
  syncState: DesktopSyncState;
  liveIssues?: string[];
  connections: DesktopConnection[];
  currentAgentConnections: DesktopConnection[];
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
