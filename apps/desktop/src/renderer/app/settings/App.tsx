import { useMemo, useState } from "react";

import { readCodexAuthJsonPath } from "../../connections/AuthJsonPath";
import type { AgentDetailTab } from "../../agents/detail/Page";
import { useNotificationHistory } from "./useNotificationHistory";
import { useNotificationUnread } from "./useNotificationUnread";
import { useNotificationMute } from "./useNotificationMute";
import { useDesktopPreferences } from "./usePreferences";
import { useProfileFeature } from "./useProfileFeature";
import { useSettingsNavigation } from "./useNavigation";
import { useDesktopData } from "./useData";
import { useSidebarState } from "./useSidebarState";
import { SettingsChrome } from "./Chrome";
import { SettingsDialogs } from "./Dialogs";
import { SettingsPageContent } from "./PageContent";
import { ErrorShell, LoadingShell } from "./Shell";
import { useNotificationTargetNavigation, type NotificationTargetNavigatorOptions } from "./useNotificationTargetNavigation";
import { useDesktopReleaseInfo } from "./useReleaseInfo";
import { useSettingsConnectionActions } from "./useConnectionActions";
import { useSettingsFlow } from "./useFlow";
import { readCurrentProfile } from "../../../profiles/CurrentProfile";
import { useWorkspaceProfiles, type WorkspaceProfileAssignment } from "../../profiles/useProfiles";

export function SettingsApp() {
  const {
    canConfigureAgent,
    definitions,
    error,
    historyState,
    isLoading,
    readDefinitionsForAgent,
    reload,
    refresh,
    settingsState,
  } = useDesktopData();
  const { preferences, setPreferences, t } = useDesktopPreferences();
  const {
    isLoaded: isNotificationMuteLoaded,
    isSaving: isSavingNotificationMute,
    notificationsMuted,
    setNotificationsMuted,
  } = useNotificationMute();
  const {
    isLoaded: isProfileFeatureLoaded,
    isSaving: isSavingProfileFeature,
    profileFeatureEnabled,
    setProfileFeatureEnabled,
  } = useProfileFeature();
  const { sidebarOpen, setSidebarOpen } = useSidebarState();
  const {
    addConnectionReturnTarget,
    addConnectionTargetAgentId,
    currentPage,
    hasSavedConnections,
    notificationHistoryFilter,
    openAddConnectionPage,
    repairUsageConnectionId,
    reusedConnectionDialog,
    selectedAgentDetailId,
    selectedConnectionContextAgentId,
    selectedConnectionId,
    selectedProfileId,
    setCurrentPage,
    setNotificationHistoryFilter,
    setRepairUsageConnectionId,
    setReusedConnectionDialog,
    setSelectedAgentDetailId,
    setSelectedConnectionContextAgentId,
    setSelectedConnectionId,
    setSelectedProfileId,
    showAgents,
    showConnections,
    showProfiles,
    showQuickSetupNav,
    visiblePage,
  } = useSettingsNavigation({
    profileFeatureEnabled: isProfileFeatureLoaded ? profileFeatureEnabled : false,
    quickSetupDismissed: preferences.quickSetupDismissed,
    settingsState,
  });
  const [nileDialogOpen, setNileDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedAgentDetailTab, setSelectedAgentDetailTab] = useState<AgentDetailTab>("connections");
  const releaseInfo = useDesktopReleaseInfo();
  const { profiles, profileError, refreshProfiles } = useWorkspaceProfiles();
  const {
    connectionTargets: notificationHistoryConnections,
    entries: notificationHistoryState,
    isLoading: isLoadingNotificationHistory,
    isMarkingRead: isMarkingNotificationHistoryRead,
    markRead: markNotificationHistoryRead,
    markReadByFilter: markNotificationHistoryReadByFilter,
    reload: reloadNotificationHistory,
  } = useNotificationHistory(
    visiblePage === "notifications",
    visiblePage === "notifications" ? notificationHistoryFilter : undefined,
  );
  const hasUnreadNotifications = useNotificationUnread(true);
  const {
    closeAddConnectionPage,
    completeQuickSetup,
    isResetting,
    openQuickSetup,
    resetDesktopState,
  } = useSettingsFlow({
    addConnectionReturnTarget,
    hasSavedConnections,
    refresh,
    refreshProfiles,
    setCurrentPage,
    setPreferences,
  });

  const addConnectionDefinitions = useMemo(
    () => readDefinitionsForAgent(addConnectionTargetAgentId),
    [addConnectionTargetAgentId, readDefinitionsForAgent],
  );
  const defaultOpenAiAuthJsonPath = useMemo(
    () => readCodexAuthJsonPath(settingsState?.advanced.agentHomes),
    [settingsState?.advanced.agentHomes],
  );
  const repairUsageConnection =
    settingsState?.connections.find((connection) => connection.id === repairUsageConnectionId) ?? null;
  const selectedConnectionContextAgent =
    settingsState?.agents.find((agent) => agent.agentId === selectedConnectionContextAgentId) ?? null;
  const currentProfile = useMemo(
    () => profileFeatureEnabled
      ? readCurrentProfile(profiles, settingsState?.agents ?? [], settingsState?.advanced.agentHomes ?? [])
      : null,
    [profileFeatureEnabled, profiles, settingsState?.advanced.agentHomes, settingsState?.agents],
  );
  const notificationTargetNavigation = useMemo<NotificationTargetNavigatorOptions>(() => ({
    onOpenAgents: (agentId) => {
      setSelectedAgentDetailId(agentId ?? null);
      setCurrentPage("agents");
    },
    onOpenConnections: (connectionId, agentId) => {
      setSelectedConnectionId(connectionId ?? null);
      setSelectedConnectionContextAgentId(agentId ?? null);
      setCurrentPage("connections");
    },
    onOpenNotifications: (connectionId, kind) => {
      setNotificationHistoryFilter({
        connectionId: connectionId ?? null,
        kind: kind ?? "all",
      });
      setCurrentPage("notifications");
    },
    onOpenProfiles: (profileId) => {
      setSelectedProfileId(profileId ?? null);
      setCurrentPage("profiles");
    },
    onOpenSettings: () => {
      setCurrentPage("settings");
    },
  }), [
    setCurrentPage,
    setNotificationHistoryFilter,
    setSelectedAgentDetailId,
    setSelectedConnectionContextAgentId,
    setSelectedConnectionId,
    setSelectedProfileId,
  ]);
  const { openNotificationTarget } = useNotificationTargetNavigation(notificationTargetNavigation);

  if (isLoading && (!settingsState || !historyState)) {
    return <LoadingShell label={t("loading.desktop")} />;
  }

  if ((!settingsState || !historyState) && error) {
    return (
      <ErrorShell
        description={error}
        isResetting={isResetting}
        resetLabel={t("settings.reset.action")}
        retryLabel={t("common.refresh")}
        title={t("common.configurationError")}
        onReset={() => {
          void resetDesktopState();
        }}
        onRetry={() => {
          void refresh();
        }}
      />
    );
  }

  if (!settingsState || !historyState) {
    return <LoadingShell label={t("loading.desktop")} />;
  }

  const {
    addConnection,
    bindCursorUsage,
    continueReusedConnection,
    importCurrentConnection,
    openConnection,
    prepareConnectionDraft,
    removeConnection,
    rollbackAgent,
    savePreparedConnection,
    useExistingConnectionForAgent,
    updateConnection,
    useConnection,
  } = useSettingsConnectionActions({
    addConnectionReturnTarget,
    reload,
    refresh,
    reusedConnectionDialog,
    settingsState,
    setCurrentPage,
    setRepairUsageConnectionId,
    setReusedConnectionDialog,
    setSelectedAgentDetailId,
    setSelectedConnectionContextAgentId,
    setSelectedConnectionId,
    onActionError: setActionError,
  });

  return (
    <SettingsChrome
      currentPage={currentPage}
      error={actionError ?? error}
      hasUnreadNotifications={hasUnreadNotifications}
      isSidebarOpen={sidebarOpen}
      currentProfileEmoji={currentProfile?.emoji ?? ""}
      currentProfileName={currentProfile?.name ?? null}
      showAgents={showAgents}
      showConnections={showConnections}
      showProfiles={showProfiles}
      showQuickSetup={showQuickSetupNav}
      t={t}
      onOpenAbout={() => setNileDialogOpen(true)}
      onOpenNotifications={() => {
        setNotificationHistoryFilter({
          connectionId: null,
          kind: "all",
        });
        setCurrentPage("notifications");
      }}
      onPageChange={setCurrentPage}
      onRefresh={async () => {
        setActionError(null);
        await refresh();
      }}
      onSidebarOpenChange={setSidebarOpen}
    >
      <SettingsPageContent
        addConnectionDefinitions={addConnectionDefinitions}
        addConnectionTargetAgentId={addConnectionTargetAgentId}
        canConfigureAgent={canConfigureAgent}
        defaultOpenAiAuthJsonPath={defaultOpenAiAuthJsonPath}
        definitions={definitions}
        historyState={historyState}
        isLoadedNotificationMute={isNotificationMuteLoaded}
        isLoadingNotificationHistory={isLoadingNotificationHistory}
        isMarkingNotificationHistoryRead={isMarkingNotificationHistoryRead}
        isSavingNotificationMute={isSavingNotificationMute}
        isResetting={isResetting}
        language={preferences.language}
        notificationsMuted={notificationsMuted}
        notificationHistoryFilter={notificationHistoryFilter}
        notificationHistoryConnections={notificationHistoryConnections}
        notificationHistoryState={notificationHistoryState}
        preferences={preferences}
        profileFeatureEnabled={profileFeatureEnabled}
        isSavingProfileFeature={isSavingProfileFeature}
        releaseInfo={releaseInfo}
        profileError={profileError}
        profiles={profiles}
        selectedAgentDetailId={selectedAgentDetailId}
        selectedAgentDetailTab={selectedAgentDetailTab}
        selectedConnectionContextAgent={selectedConnectionContextAgent}
        selectedConnectionId={selectedConnectionId}
        selectedProfileId={selectedProfileId}
        settingsState={settingsState}
        showQuickSetupNav={showQuickSetupNav}
        showProfiles={showProfiles}
        t={t}
        visiblePage={visiblePage}
        onAddConnection={addConnection}
        onAgentOrderChange={(agentOrder) => setPreferences((current) => ({ ...current, agentOrder }))}
        onBackFromAgentDetail={() => setCurrentPage("agents")}
        onBindCursorUsage={bindCursorUsage}
        onCreateConnectionAlert={async (input) => {
          await window.nileDesktop.connections.createUsageAlert(input);
          await reload();
        }}
        onCheckForUpdates={async () => {
          await window.nileDesktop.updates.checkForUpdates().catch(() => ({ status: "unavailable" as const }));
        }}
        onCloseAddConnectionPage={closeAddConnectionPage}
        onCompleteQuickSetup={completeQuickSetup}
        onApplyProfile={async (profileId) => {
          await window.nileDesktop.profiles.applyProfile(profileId);
          await refresh();
        }}
        onCreateProfile={async (name, emoji, assignments: WorkspaceProfileAssignment[]) => {
          const profile = await window.nileDesktop.profiles.createProfile(name, emoji, assignments);
          await refreshProfiles();
          return profile.id;
        }}
        onDeleteProfile={async (profileId) => {
          await window.nileDesktop.profiles.deleteProfile(profileId);
          await refreshProfiles();
        }}
        onDeleteConnectionAlert={async (connectionId, alertId) => {
          await window.nileDesktop.connections.deleteUsageAlert(connectionId, alertId);
          await reload();
        }}
        onConfigureAgent={(agentId) => openAddConnectionPage(agentId)}
        onConfirmImportAgent={importCurrentConnection}
        onInstallUpdate={async () => {
          await window.nileDesktop.updates.installUpdate().catch(() => ({ status: "unavailable" as const }));
        }}
        onLanguageChange={(language) => setPreferences((current) => ({ ...current, language }))}
        onNotificationsMutedChange={setNotificationsMuted}
        onNotificationHistoryFilterChange={(filter) => {
          setNotificationHistoryFilter(filter);
          setCurrentPage("notifications");
        }}
        onMarkNotificationHistoryRead={markNotificationHistoryRead}
        onMarkNotificationHistoryReadByFilter={async (filter) => {
          await markNotificationHistoryReadByFilter(filter);
        }}
        onOpenAddConnection={() => openAddConnectionPage()}
        onOpenConnection={openConnection}
        onOpenNotificationTarget={openNotificationTarget}
        onOpenProvidersLink={async (url) => {
          await window.nileDesktop.app.openExternalUrl(url);
        }}
        onOpenQuickSetup={openQuickSetup}
        onOpenQuickSetupModelSetup={(agentId) => {
          setSelectedAgentDetailId(agentId);
          setSelectedAgentDetailTab("connections");
          setCurrentPage("agents");
        }}
        onProfileFeatureEnabledChange={setProfileFeatureEnabled}
        onPrepareConnectionDraft={prepareConnectionDraft}
        onRefresh={refresh}
        onRefreshNotificationHistory={reloadNotificationHistory}
        onRemoveConnection={removeConnection}
        onReset={() => setResetDialogOpen(true)}
        onRollbackAgent={rollbackAgent}
        onSavePreparedConnection={savePreparedConnection}
        onUseExistingQuickSetupConnection={useExistingConnectionForAgent}
        onSelectAgentDetail={(agentId) => {
          setSelectedAgentDetailId(agentId);
          if (!agentId) {
            setSelectedAgentDetailTab("connections");
          }
        }}
        onSelectAgentDetailTab={setSelectedAgentDetailTab}
        onSelectConnection={setSelectedConnectionId}
        onSelectConnectionContextAgent={setSelectedConnectionContextAgentId}
        onSelectProfile={setSelectedProfileId}
        onThemeChange={(theme) => setPreferences((current) => ({ ...current, theme }))}
        onUpdateAgentHome={async (agentId, path) => {
          await window.nileDesktop.app.updateAgentHome(agentId, path);
        }}
        onUpdateAgentConnectionModel={async (agentId, connectionId, modelId) => {
          await window.nileDesktop.connections.updateAgentConnectionModel({
            agentId,
            connectionId,
            modelId,
          });
          const agent = settingsState.agents.find((entry) => entry.agentId === agentId) ?? null;
          if (agent?.currentConnection?.id === connectionId) {
            await window.nileDesktop.connections.switchConnection(agentId, connectionId);
          }
          await refresh();
        }}
        onUpdateConnectionAlert={async (input) => {
          await window.nileDesktop.connections.updateUsageAlert(input);
          await reload();
        }}
        onSaveProfile={async (profileId, name, emoji, assignments) => {
          await window.nileDesktop.profiles.updateProfile(profileId, name, emoji, assignments);
          await refreshProfiles();
        }}
        onUpdateConnection={updateConnection}
        onUseConnection={useConnection}
      />

      <SettingsDialogs
        isResetDialogOpen={resetDialogOpen}
        isResetting={isResetting}
        isSupportOpen={nileDialogOpen}
        repairUsageConnection={repairUsageConnection}
        reusedConnectionDialog={reusedConnectionDialog}
        t={t}
        onBindCursorUsage={async (connectionId, sessionToken) => {
          await window.nileDesktop.connections.bindCursorUsage(connectionId, sessionToken);
        }}
        onCloseRepairUsage={() => setRepairUsageConnectionId(null)}
        onOpenGitHubIssues={async () => {
          await window.nileDesktop.app.openGitHubIssues();
        }}
        onOpenSupport={async () => {
          await window.nileDesktop.app.openSupportEmail();
        }}
        onRefresh={refresh}
        onContinueReusedConnection={continueReusedConnection}
        onResetConfirm={async () => {
          await resetDesktopState(() => setResetDialogOpen(false));
        }}
        onSetNileDialogOpen={setNileDialogOpen}
        onSetResetDialogOpen={setResetDialogOpen}
      />
    </SettingsChrome>
  );
}
