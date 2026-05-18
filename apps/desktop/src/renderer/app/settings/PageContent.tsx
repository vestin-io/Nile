import type { AgentId } from "@nile/core/models/agent/definitions";

import type { DesktopAgentState, DesktopNotificationHistoryConnection, DesktopReleaseInfo } from "../../../state/Types";
import type { CreateConnectionAlertInput, UpdateConnectionAlertInput } from "../../../electron/alerts/Store";
import type { DesktopNotificationTarget } from "../../../electron/notifications/contracts";
import { AgentPage } from "../../agents/AgentPage";
import { AddConnectionPage } from "../../connections/add/Page";
import { ConnectionsPage } from "../../connections/list/Page";
import { NotificationsPage } from "../../notifications/Page";
import { ProvidersPage } from "../../providers/ProvidersPage";
import { ProfilesPage } from "../../profiles/Page";
import type { WorkspaceProfile, WorkspaceProfileAssignment } from "../../profiles/useProfiles";
import { QuickSetupPage } from "../../quick-setup/Page";
import { SettingsPage } from "../../settings/general/Page";
import type {
  DesktopPreferences,
  LanguagePreference,
  ThemePreference,
} from "../../settings/Preferences";
import type { HistoryState, NotificationHistoryState, SettingsState } from "../../shared/DesktopData";
import type { Definition } from "../../shared/DesktopData";
import type { Translator } from "../../shared/I18n";
import type { AgentDetailTab } from "../../agents/detail/Page";
import type { NotificationHistoryFilter, PageId } from "./useNavigation";
import type {
  AddConnectionPreparedSaveInput,
  AddConnectionSubmitInput,
  PreparedConnectionDraft,
} from "../../connections/add/Types";

type SettingsPageContentProps = {
  addConnectionDefinitions: Definition[];
  addConnectionTargetAgentId: AgentId | null;
  canConfigureAgent(agentId: AgentId): boolean;
  defaultOpenAiAuthJsonPath: string;
  definitions: Definition[];
  historyState: HistoryState;
  isLoadedNotificationMute: boolean;
  isLoadedMenubarDisplay: boolean;
  isLoadingNotificationHistory: boolean;
  isMarkingNotificationHistoryRead: boolean;
  isSavingMenubarDisplay: boolean;
  isSavingNotificationMute: boolean;
  isResetting: boolean;
  isSavingProfileFeature: boolean;
  language: LanguagePreference;
  menubarDisplayMode: Awaited<ReturnType<typeof window.nileDesktop.state.getMenubarDisplay>>["mode"];
  notificationsMuted: boolean;
  notificationHistoryFilter: NotificationHistoryFilter;
  notificationHistoryConnections: DesktopNotificationHistoryConnection[];
  notificationHistoryState: NotificationHistoryState;
  preferences: DesktopPreferences;
  profileFeatureEnabled: boolean;
  profileError: string | null;
  profiles: WorkspaceProfile[];
  releaseInfo: DesktopReleaseInfo | null;
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
  onCreateConnectionAlert(input: CreateConnectionAlertInput): Promise<void>;
  onCheckForUpdates(): Promise<void>;
  onCloseAddConnectionPage(): void;
  onConfigureAgent(agentId: AgentId): void;
  onConfirmImportAgent(agentId: AgentId): Promise<void>;
  onCompleteQuickSetup(): void;
  onOpenQuickSetupModelSetup(agentId: AgentId): void;
  onUseExistingQuickSetupConnection(agentId: AgentId, connectionId: string): Promise<void>;
  onUpdateAgentConnectionModel(agentId: AgentId, connectionId: string, modelId: string | null): Promise<void>;
  onCreateProfile(name: string, emoji: string, assignments: WorkspaceProfileAssignment[]): Promise<string>;
  onDeleteProfile(profileId: string): Promise<void>;
  onInstallUpdate(): Promise<void>;
  onLanguageChange(language: LanguagePreference): void;
  onMenubarDisplayModeChange(
    mode: Awaited<ReturnType<typeof window.nileDesktop.state.getMenubarDisplay>>["mode"],
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

export function SettingsPageContent({
  addConnectionDefinitions,
  addConnectionTargetAgentId,
  canConfigureAgent,
  defaultOpenAiAuthJsonPath,
  definitions,
  historyState,
  isLoadedNotificationMute,
  isLoadedMenubarDisplay,
  isLoadingNotificationHistory,
  isMarkingNotificationHistoryRead,
  isSavingMenubarDisplay,
  isSavingNotificationMute,
  isResetting,
  isSavingProfileFeature,
  language,
  menubarDisplayMode,
  notificationsMuted,
  notificationHistoryFilter,
  notificationHistoryConnections,
  notificationHistoryState,
  preferences,
  profileFeatureEnabled,
  profileError,
  profiles,
  releaseInfo,
  selectedAgentDetailId,
  selectedAgentDetailTab,
  selectedConnectionContextAgent,
  selectedConnectionId,
  selectedProfileId,
  settingsState,
  showQuickSetupNav,
  showProfiles,
  t,
  visiblePage,
  onAddConnection,
  onApplyProfile,
  onAgentOrderChange,
  onBackFromAgentDetail,
  onBindCursorUsage,
  onCreateConnectionAlert,
  onCheckForUpdates,
  onCloseAddConnectionPage,
  onConfigureAgent,
  onConfirmImportAgent,
  onCompleteQuickSetup,
  onOpenQuickSetupModelSetup,
  onUseExistingQuickSetupConnection,
  onCreateProfile,
  onDeleteProfile,
  onInstallUpdate,
  onLanguageChange,
  onMenubarDisplayModeChange,
  onNotificationsMutedChange,
  onNotificationHistoryFilterChange,
  onMarkNotificationHistoryRead,
  onMarkNotificationHistoryReadByFilter,
  onOpenAddConnection,
  onOpenConnection,
  onOpenNotificationTarget,
  onOpenProvidersLink,
  onOpenQuickSetup,
  onProfileFeatureEnabledChange,
  onPrepareConnectionDraft,
  onRefresh,
  onRefreshNotificationHistory,
  onRemoveConnection,
  onReset,
  onRollbackAgent,
  onSavePreparedConnection,
  onSelectAgentDetail,
  onSelectAgentDetailTab,
  onSelectConnection,
  onSelectConnectionContextAgent,
  onSelectProfile,
  onThemeChange,
  onUpdateAgentHome,
  onUpdateAgentConnectionModel,
  onSaveProfile,
  onDeleteConnectionAlert,
  onUpdateConnectionAlert,
  onUpdateConnection,
  onUseConnection,
}: SettingsPageContentProps) {
  if (visiblePage === "quick-setup") {
    return (
      <QuickSetupPage
        canConfigureAgent={canConfigureAgent}
        state={settingsState}
        t={t}
        onConfigureAgent={onConfigureAgent}
        onConfirmAgent={onConfirmImportAgent}
        onDone={onCompleteQuickSetup}
        onOpenModelSetup={onOpenQuickSetupModelSetup}
        onUpdateAgentConnectionModel={onUpdateAgentConnectionModel}
        onUseExistingConnection={onUseExistingQuickSetupConnection}
      />
    );
  }

  if (visiblePage === "agents") {
    return (
      <AgentPage
        agents={settingsState.agents}
        agentHomes={settingsState.advanced.agentHomes}
        agentOrder={preferences.agentOrder}
        canConfigureAgent={canConfigureAgent}
        detectedSetups={settingsState.detectedSetups}
        history={historyState}
        selectedDetailAgentId={selectedAgentDetailId}
        selectedDetailTab={selectedAgentDetailTab}
        showQuickSetupEntry={!showQuickSetupNav}
        t={t}
        onAgentOrderChange={onAgentOrderChange}
        onAgentHomeSave={onUpdateAgentHome}
        onConfigureAgent={onConfigureAgent}
        onImport={onConfirmImportAgent}
        onOpenQuickSetup={onOpenQuickSetup}
        onOpenAddPage={onConfigureAgent}
        onOpenConnection={onOpenConnection}
        onRefresh={onRefresh}
        onRollback={onRollbackAgent}
        onUpdateAgentConnectionModel={onUpdateAgentConnectionModel}
        onSelectedDetailAgentIdChange={onSelectAgentDetail}
        onSelectedDetailTabChange={onSelectAgentDetailTab}
        onSwitch={onUseConnection}
      />
    );
  }

  if (visiblePage === "connections") {
    return (
      <ConnectionsPage
        detailContextAgent={selectedConnectionContextAgent}
        defaultOpenAiAuthJsonPath={defaultOpenAiAuthJsonPath}
        definitions={definitions}
        language={language}
        state={settingsState}
        selectedConnectionId={selectedConnectionId}
        t={t}
        onBackFromAgentDetail={onBackFromAgentDetail}
        onOpenAddPage={onOpenAddConnection}
        onSelectConnection={(connectionId) => {
          onSelectConnection(connectionId);
          if (connectionId) {
            return;
          }
          onSelectConnectionContextAgent(null);
        }}
        onRefresh={onRefresh}
        onBindCursorUsage={onBindCursorUsage}
        onCreateAlert={onCreateConnectionAlert}
        onDeleteAlert={onDeleteConnectionAlert}
        onRemove={onRemoveConnection}
        onOpenNotificationHistory={(connectionId) => {
          onNotificationHistoryFilterChange({
            connectionId,
            kind: "alerts",
          });
        }}
        onUpdateAlert={onUpdateConnectionAlert}
        onUpdateConnection={onUpdateConnection}
      />
    );
  }

  if (visiblePage === "notifications") {
    return (
      <NotificationsPage
        connections={settingsState.connections}
        entries={notificationHistoryState}
        filter={notificationHistoryFilter}
        historyConnections={notificationHistoryConnections}
        isLoading={isLoadingNotificationHistory}
        isMarkingAllRead={isMarkingNotificationHistoryRead}
        t={t}
        onFilterChange={onNotificationHistoryFilterChange}
        onMarkRead={onMarkNotificationHistoryRead}
        onMarkAllRead={onMarkNotificationHistoryReadByFilter}
        onOpenEntry={onOpenNotificationTarget}
        onRefresh={onRefreshNotificationHistory}
      />
    );
  }

  if (visiblePage === "profiles") {
    return (
      <ProfilesPage
        agentHomes={settingsState.advanced.agentHomes}
        agents={settingsState.agents}
        isAvailable={showProfiles}
        profileError={profileError}
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        t={t}
        onApplyProfile={onApplyProfile}
        onBackFromDetail={() => onSelectProfile(null)}
        onCreateProfile={onCreateProfile}
        onDeleteProfile={onDeleteProfile}
        onOpenProfile={onSelectProfile}
        onSaveProfile={onSaveProfile}
      />
    );
  }

  if (visiblePage === "add-connection") {
    return (
      <AddConnectionPage
        key={addConnectionTargetAgentId ?? "all"}
        defaultOpenAiAuthJsonPath={defaultOpenAiAuthJsonPath}
        definitions={addConnectionDefinitions}
        language={language}
        targetAgentId={addConnectionTargetAgentId}
        t={t}
        onBack={onCloseAddConnectionPage}
        onPrepareDraft={onPrepareConnectionDraft}
        onSavePrepared={onSavePreparedConnection}
        onSubmit={onAddConnection}
      />
    );
  }

  if (visiblePage === "settings") {
    return (
      <SettingsPage
        isLoadedNotificationMute={isLoadedNotificationMute}
        isLoadedMenubarDisplay={isLoadedMenubarDisplay}
        isSavingMenubarDisplay={isSavingMenubarDisplay}
        menubarDisplayMode={menubarDisplayMode}
        isSavingNotificationMute={isSavingNotificationMute}
        isResetting={isResetting}
        isSavingProfileFeature={isSavingProfileFeature}
        notificationsMuted={notificationsMuted}
        preferences={preferences}
        profileFeatureEnabled={profileFeatureEnabled}
        releaseInfo={releaseInfo}
        t={t}
        onCheckForUpdates={onCheckForUpdates}
        onInstallUpdate={onInstallUpdate}
        onLanguageChange={onLanguageChange}
        onMenubarDisplayModeChange={onMenubarDisplayModeChange}
        onNotificationsMutedChange={onNotificationsMutedChange}
        onProfileFeatureEnabledChange={onProfileFeatureEnabledChange}
        onReset={onReset}
        onThemeChange={onThemeChange}
      />
    );
  }

  return (
    <ProvidersPage
      language={language}
      t={t}
      onOpenOfficialLink={onOpenProvidersLink}
    />
  );
}
