import type { AgentId } from "@nile/core/models/agent";
import type { CredentialStorageBackend } from "@nile/core/services/credential";

import type { CreateConnectionAlertInput, UpdateConnectionAlertInput } from "../../../electron/alerts/Store";
import type { DesktopNotificationTarget } from "../../../electron/notifications/contracts";
import type { DesktopAgentState, DesktopNotificationHistoryConnection, DesktopReleaseInfo } from "../../../state/Types";
import type { AgentDetailTab } from "../../agents/detail/Page";
import type {
  AddConnectionPreparedSaveInput,
  AddConnectionSubmitInput,
  PreparedConnectionDraft,
} from "../../connections/add/Types";
import type { WorkspaceProfile, WorkspaceProfileAssignment } from "../../profiles/useProfiles";
import type { DesktopPreferences, LanguagePreference, ThemePreference } from "../../settings/Preferences";
import type { Definition, HistoryState, NotificationHistoryState, SettingsState } from "../../shared/DesktopData";
import type { Translator } from "../../shared/I18n";
import type { NotificationHistoryFilter, PageId } from "./useNavigation";

export type SettingsPageContentProps = {
  credentialStorageMode: CredentialStorageBackend | null;
  isCredentialStorageModeLocked: boolean;
  isCredentialStorageModeMixed: boolean;
  isCredentialPortabilityBusy: boolean;
  credentialStorageState: Awaited<ReturnType<typeof window.nileDesktop.connections.getCredentialStorageState>>;
  addConnectionDefinitions: Definition[];
  addConnectionTargetAgentId: AgentId | null;
  canConfigureAgent(agentId: AgentId): boolean;
  defaultOpenAiAuthJsonPath: string;
  definitions: Definition[];
  historyState: HistoryState;
  isLoadedNotificationMute: boolean;
  isLoadedStatusEntryDisplay: boolean;
  isLoadingNotificationHistory: boolean;
  isMarkingNotificationHistoryRead: boolean;
  isSavingStatusEntryDisplay: boolean;
  isSavingNotificationMute: boolean;
  isResetting: boolean;
  isSavingProfileFeature: boolean;
  language: LanguagePreference;
  statusEntryDisplayMode: Awaited<ReturnType<typeof window.nileDesktop.statusEntry.getStatusEntryDisplay>>["mode"];
  notificationsMuted: boolean;
  notificationHistoryFilter: NotificationHistoryFilter;
  notificationHistoryConnections: DesktopNotificationHistoryConnection[];
  notificationHistoryState: NotificationHistoryState;
  preferences: DesktopPreferences;
  profileFeatureEnabled: boolean;
  profileError: string | null;
  profiles: WorkspaceProfile[];
  releaseInfo: DesktopReleaseInfo | null;
  savedConnectionCount: number;
  selectedAgentDetailId: AgentId | null;
  selectedAgentDetailTab: AgentDetailTab;
  selectedConnectionContextAgent: DesktopAgentState | null;
  selectedConnectionId: string | null;
  selectedProfileId: string | null;
  settingsState: SettingsState;
  showQuickSetupNav: boolean;
  showProfiles: boolean;
  t: Translator;
  visiblePage: PageId;
  onAddConnection(input: AddConnectionSubmitInput): Promise<void>;
  onApplyProfile(profileId: string): Promise<void>;
  onAgentOrderChange(agentOrder: AgentId[]): void;
  onBackFromAgentDetail(): void;
  onBindCursorUsage(connectionId: string): Promise<void>;
  onReauthenticateConnection(connectionId: string): Promise<void>;
  onCreateConnectionAlert(input: CreateConnectionAlertInput): Promise<void>;
  onCheckForUpdates(): Promise<void>;
  onExportCredentials(selectedConnectionIds?: string[]): Promise<void>;
  onCloseAddConnectionPage(): void;
  onConfigureAgent(agentId: AgentId): void;
  onRememberCredentialStorageMode(backend: CredentialStorageBackend): void;
  onConfirmImportAgent(agentId: AgentId): Promise<void>;
  onImportCredentials(): Promise<void>;
  onQuickSetupSaveAgent(
    agentId: AgentId,
    input: {
      credentialStorageBackend: CredentialStorageBackend;
      encryptedLocalPassphrase?: string;
    },
  ): Promise<void>;
  onCompleteQuickSetup(): void;
  onRefreshCredentialStorageState(): Promise<Awaited<ReturnType<typeof window.nileDesktop.connections.getCredentialStorageState>>>;
  onOpenQuickSetupModelSetup(agentId: AgentId): void;
  onUseExistingQuickSetupConnection(agentId: AgentId, connectionId: string): Promise<void>;
  onUpdateAgentConnectionModel(agentId: AgentId, connectionId: string, modelId: string | null): Promise<void>;
  onCreateProfile(name: string, emoji: string, assignments: WorkspaceProfileAssignment[]): Promise<string>;
  onDeleteProfile(profileId: string): Promise<void>;
  onInstallUpdate(): Promise<void>;
  onLanguageChange(language: LanguagePreference): void;
  onStatusEntryDisplayModeChange(
    mode: Awaited<ReturnType<typeof window.nileDesktop.statusEntry.getStatusEntryDisplay>>["mode"],
  ): Promise<void>;
  onNotificationsMutedChange(muted: boolean): Promise<void>;
  onNotificationHistoryFilterChange(filter: NotificationHistoryFilter): void;
  onMarkNotificationHistoryRead(entryIds: string[]): Promise<void>;
  onMarkNotificationHistoryReadByFilter(filter: NotificationHistoryFilter): Promise<void>;
  onOpenAddConnection(): void;
  onOpenConnection(connectionId: string, agentId: AgentId): void;
  onOpenNotificationTarget(target: DesktopNotificationTarget): void;
  onOpenProvidersLink(url: string): Promise<void>;
  onOpenQuickSetup(): void;
  onProfileFeatureEnabledChange(enabled: boolean): Promise<void>;
  onPrepareConnectionDraft(input: AddConnectionSubmitInput): Promise<PreparedConnectionDraft>;
  onRefresh(): Promise<void>;
  onRefreshNotificationHistory(): Promise<void>;
  onRemoveConnection(connectionId: string): Promise<void>;
  onReset(): void;
  onRollbackAgent(agentId: AgentId): Promise<void>;
  onSavePreparedConnection(input: AddConnectionPreparedSaveInput): Promise<void>;
  onSelectAgentDetail(agentId: AgentId | null): void;
  onSelectAgentDetailTab(tab: AgentDetailTab): void;
  onSelectConnection(connectionId: string | null): void;
  onSelectConnectionContextAgent(agentId: AgentId | null): void;
  onSelectProfile(profileId: string | null): void;
  onThemeChange(theme: ThemePreference): void;
  onUpdateAgentHome(agentId: AgentId, path: string | null): Promise<void>;
  onUpdateAgentRuntimeCommand(agentId: AgentId, path: string | null): Promise<void>;
  onSaveProfile(profileId: string, name: string, emoji: string, assignments: WorkspaceProfileAssignment[]): Promise<void>;
  onDeleteConnectionAlert(connectionId: string, alertId: string): Promise<void>;
  onUpdateConnectionAlert(input: UpdateConnectionAlertInput): Promise<void>;
  onUpdateConnection(input: {
    connectionId: string;
    label?: string;
    enabledAgents?: AgentId[];
    endpointUrl?: string;
    apiKeySource?: "direct" | "env_key";
    apiKey?: string;
    envKey?: string;
    sessionSource?: "login" | "current_codex" | "current_claude" | "current_gemini" | "current_cursor";
    sessionAuthJsonPath?: string;
    syncSelectedAgents?: boolean;
  }): Promise<void>;
  onUseConnection(agentId: AgentId, connectionId: string): Promise<void>;
};
