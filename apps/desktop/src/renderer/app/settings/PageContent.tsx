import { AgentPage } from "../../agents/AgentPage";
import { AddConnectionPage } from "../../connections/add/Page";
import { ConnectionsPage } from "../../connections/list/Page";
import { NotificationsPage } from "../../notifications/Page";
import { ProvidersPage } from "../../providers/ProvidersPage";
import { ProfilesPage } from "../../profiles/Page";
import { QuickSetupPage } from "../../quick-setup/Page";
import { SettingsPage } from "../../settings/general/Page";
import type { SettingsPageContentProps } from "./PageContentProps";
export type { SettingsPageContentProps } from "./PageContentProps";

export function SettingsPageContent({
  credentialStorageMode,
  addConnectionDefinitions,
  addConnectionTargetAgentId,
  canConfigureAgent,
  credentialStorageState,
  isCredentialStorageModeLocked,
  isCredentialStorageModeMixed,
  isCredentialPortabilityBusy,
  defaultOpenAiAuthJsonPath,
  definitions,
  historyState,
  isLoadedNotificationMute,
  isLoadedStatusEntryDisplay,
  isLoadingNotificationHistory,
  isMarkingNotificationHistoryRead,
  isSavingStatusEntryDisplay,
  isSavingNotificationMute,
  isResetting,
  isSavingProfileFeature,
  language,
  statusEntryDisplayMode,
  notificationsMuted,
  notificationHistoryFilter,
  notificationHistoryConnections,
  notificationHistoryState,
  preferences,
  profileFeatureEnabled,
  profileError,
  profiles,
  releaseInfo,
  savedConnectionCount,
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
  onQuickSetupSaveAgent,
  onCompleteQuickSetup,
  onRefreshCredentialStorageState,
  onOpenQuickSetupModelSetup,
  onUseExistingQuickSetupConnection,
  onCreateProfile,
  onDeleteProfile,
  onExportCredentials,
  onInstallUpdate,
  onImportCredentials,
  onLanguageChange,
  onStatusEntryDisplayModeChange,
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
  onRememberCredentialStorageMode,
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
  onUpdateAgentRuntimeCommand,
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
        credentialStorageState={credentialStorageState}
        credentialStorageMode={credentialStorageMode}
        state={settingsState}
        isCredentialStorageModeLocked={isCredentialStorageModeLocked}
        isCredentialStorageModeMixed={isCredentialStorageModeMixed}
        t={t}
        onConfigureAgent={onConfigureAgent}
        onSaveAgent={onQuickSetupSaveAgent}
        onDone={onCompleteQuickSetup}
        onRefreshCredentialStorageState={onRefreshCredentialStorageState}
        onOpenModelSetup={onOpenQuickSetupModelSetup}
        onRememberCredentialStorageMode={onRememberCredentialStorageMode}
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
        onAgentRuntimeCommandSave={onUpdateAgentRuntimeCommand}
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
          credentialStorageMode={credentialStorageMode}
          credentialStorageState={credentialStorageState}
          detailContextAgent={selectedConnectionContextAgent}
          defaultOpenAiAuthJsonPath={defaultOpenAiAuthJsonPath}
          isCredentialStorageModeMixed={isCredentialStorageModeMixed}
          isCredentialPortabilityBusy={isCredentialPortabilityBusy}
        definitions={definitions}
        language={language}
        state={settingsState}
        selectedConnectionId={selectedConnectionId}
        t={t}
        onBackFromAgentDetail={onBackFromAgentDetail}
        onExportConnections={onExportCredentials}
        onImportConnections={onImportCredentials}
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
        credentialStorageMode={credentialStorageMode}
        isCredentialStorageModeLocked={isCredentialStorageModeLocked}
        isCredentialStorageModeMixed={isCredentialStorageModeMixed}
        defaultOpenAiAuthJsonPath={defaultOpenAiAuthJsonPath}
        credentialStorageState={credentialStorageState}
        definitions={addConnectionDefinitions}
        language={language}
        targetAgentId={addConnectionTargetAgentId}
        t={t}
        onBack={onCloseAddConnectionPage}
        onRememberCredentialStorageMode={onRememberCredentialStorageMode}
        onPrepareDraft={onPrepareConnectionDraft}
        onRefreshCredentialStorageState={onRefreshCredentialStorageState}
        onSavePrepared={onSavePreparedConnection}
        onSubmit={onAddConnection}
      />
    );
  }

  if (visiblePage === "settings") {
    return (
      <SettingsPage
        isLoadedNotificationMute={isLoadedNotificationMute}
        isLoadedStatusEntryDisplay={isLoadedStatusEntryDisplay}
        isSavingStatusEntryDisplay={isSavingStatusEntryDisplay}
        statusEntryDisplayMode={statusEntryDisplayMode}
        credentialStorageMode={credentialStorageMode}
        isCredentialStorageModeLocked={isCredentialStorageModeLocked}
        isCredentialStorageModeMixed={isCredentialStorageModeMixed}
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
        onStatusEntryDisplayModeChange={onStatusEntryDisplayModeChange}
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
