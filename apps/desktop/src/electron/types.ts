import type { AgentId, RollbackLatestAgentResult } from "@nile/core/models/agent";
import type { ResetStateResult } from "@nile/core/application/local";
import type { AuthMode } from "@nile/core/models/access";
import type { ConnectionOnboardingSuggestion, ConnectionPresetFamily } from "@nile/core/models/connection";
import type { EndpointFamily } from "@nile/core/models/endpoint";
import type { RemoveConnectionResult } from "@nile/core/application/local";
import type { ImportDetectedSetupsResult } from "@nile/core/actions/local-state";
import type { BindCursorUsageResult } from "@nile/core/actions/usage/cursor";
import type { WorkspaceProfile, WorkspaceProfileAssignment } from "./profiles/Store";

export type DesktopConnectionCredentialInput = {
  apiKeySource?: "direct" | "env_key";
  apiKey?: string;
  envKey?: string;
  openAiSessionSource?: "login" | "current_codex";
  openAiAuthJsonPath?: string;
  claudeSessionSource?: "login" | "current_claude";
};

export type DesktopAddConnectionInput = DesktopConnectionCredentialInput & {
  preset: ConnectionPresetFamily;
  authMode: AuthMode;
  label?: string;
  endpointUrl?: string;
  enabledAgents?: AgentId[];
  allowUndetectedGateway?: boolean;
};

export type DesktopConnectionSummary = {
  id: string;
  label: string;
  endpointId: string;
  endpointUrl?: string | null;
  endpointLabel: string;
  endpointFamily: EndpointFamily | "unknown";
  authMode: AuthMode;
  apiKeySource?: "direct" | "env_key";
  envKey?: string | null;
  reused?: boolean;
};

export type DesktopPreparedConnectionDraft = {
  id: string;
  authMode: AuthMode;
  labelSuggestion: string;
  configurableAgents: AgentId[];
  defaultEnabledAgents: AgentId[];
  suggestedAgents: AgentId[];
};

export type DesktopSavePreparedConnectionInput = {
  draftId: string;
  label?: string;
  enabledAgents?: AgentId[];
};

export type DesktopDiscardPreparedConnectionDraftInput = {
  draftId: string;
};

export type DesktopUpdateConnectionInput = DesktopConnectionCredentialInput & {
  connectionId: string;
  label?: string;
  enabledAgents?: AgentId[];
  endpointUrl?: string;
  syncSelectedAgents?: boolean;
};

export type DesktopDescribeSavedConnectionOnboardingInput = DesktopConnectionCredentialInput & {
  connectionId: string;
  endpointUrl?: string;
};

export type DesktopStateBridge = {
  getMenubarState(): Promise<import("../state/Types").MenubarState>;
  getSettingsState(): Promise<import("../state/Types").SettingsState>;
  getSettingsStateSnapshot(): Promise<import("../state/Types").SettingsState>;
  getHistoryState(): Promise<import("../state/Types").HistoryState>;
  getProfileFeatureEnabled(): Promise<boolean>;
  setProfileFeatureEnabled(enabled: boolean): Promise<boolean>;
  refreshSettings(): Promise<void>;
  refreshMenubar(): Promise<void>;
};

export type DesktopUpdateBridge = {
  getReleaseInfo(): Promise<import("../state/Types").DesktopReleaseInfo>;
  checkForUpdates(): Promise<import("../state/Types").DesktopUpdateCheckResult>;
  installUpdate(): Promise<import("../state/Types").DesktopInstallUpdateResult>;
};

export type DesktopConnectionBridge = {
  listConnectionDefinitions(): Promise<import("@nile/core/models/connection").ConnectionDefinition[]>;
  chooseOpenAiAuthJsonPath(defaultPath?: string): Promise<string | null>;
  describeConnectionOnboarding(input: DesktopAddConnectionInput): Promise<ConnectionOnboardingSuggestion>;
  describeSavedConnectionOnboarding(input: DesktopDescribeSavedConnectionOnboardingInput): Promise<ConnectionOnboardingSuggestion>;
  prepareConnectionDraft(input: DesktopAddConnectionInput): Promise<DesktopPreparedConnectionDraft>;
  savePreparedConnection(input: DesktopSavePreparedConnectionInput): Promise<DesktopConnectionSummary>;
  discardPreparedConnectionDraft(input: DesktopDiscardPreparedConnectionDraftInput): Promise<void>;
  switchConnection(agentId: AgentId, connectionId: string): Promise<import("../state/Types").DesktopConnection>;
  rollbackLatestMutation(agentId: AgentId): Promise<RollbackLatestAgentResult>;
  addConnection(input: DesktopAddConnectionInput): Promise<DesktopConnectionSummary>;
  updateConnection(input: DesktopUpdateConnectionInput): Promise<DesktopConnectionSummary>;
  importDetectedSetups(scanIds: AgentId[]): Promise<ImportDetectedSetupsResult>;
  importCurrentConnection(agentId: AgentId): Promise<DesktopConnectionSummary>;
  removeConnection(connectionId: string): Promise<RemoveConnectionResult>;
  bindCursorUsage(connectionId: string, sessionToken: string): Promise<BindCursorUsageResult>;
  resetState(): Promise<ResetStateResult>;
};

export type DesktopAppBridge = {
  openGitHubIssues(): Promise<void>;
  openExternalUrl(url: string): Promise<void>;
  openSettings(): Promise<void>;
  openSupportEmail(): Promise<void>;
  updateAgentHome(agentId: AgentId, path: string | null): Promise<void>;
};

export type DesktopProfileBridge = {
  listProfiles(): Promise<WorkspaceProfile[]>;
  createProfile(name: string, emoji: string | undefined, assignments: WorkspaceProfileAssignment[]): Promise<WorkspaceProfile>;
  updateProfile(
    profileId: string,
    name: string,
    emoji: string | undefined,
    assignments: WorkspaceProfileAssignment[],
  ): Promise<WorkspaceProfile>;
  deleteProfile(profileId: string): Promise<void>;
  applyProfile(profileId: string): Promise<WorkspaceProfile>;
};

export type DesktopBridge = {
  app: DesktopAppBridge;
  connections: DesktopConnectionBridge;
  profiles: DesktopProfileBridge;
  state: DesktopStateBridge;
  updates: DesktopUpdateBridge;
};
