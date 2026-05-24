import { useEffect, useMemo, useState } from "react";

import { readCodexAuthJsonPath } from "../../connections/AuthJsonPath";
import type { AgentDetailTab } from "../../agents/detail/Page";
import { useNotificationHistory } from "./useNotificationHistory";
import { useNotificationUnread } from "./useNotificationUnread";
import { useNotificationMute } from "./useNotificationMute";
import { useDesktopPreferences } from "./usePreferences";
import { useMenubarDisplay } from "./useMenubarDisplay";
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
import { UpdatePrompt } from "./UpdatePrompt";
import { useSettingsConnectionActions } from "./useConnectionActions";
import { useCredentialStorageSession } from "./useCredentialStorageSession";
import { useSettingsFlow } from "./useFlow";
import { readCurrentProfile } from "../../../profiles/CurrentProfile";
import { useWorkspaceProfiles, type WorkspaceProfileAssignment } from "../../profiles/useProfiles";
import { EncryptedLocalAccessProvider } from "../../shared/EncryptedLocalAccess";
import { readCredentialStorageModeState } from "../../shared/CredentialStorageMode";
import { useSettingsPageContentProps } from "./usePageContentProps";

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
    isLoaded: isMenubarDisplayLoaded,
    isSaving: isSavingMenubarDisplay,
    mode: menubarDisplayMode,
    setMode: setMenubarDisplayMode,
  } = useMenubarDisplay();
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
  const [dismissedUpdatePromptKey, setDismissedUpdatePromptKey] = useState<string | null>(null);
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

  const addConnectionDefinitions = useMemo(() => readDefinitionsForAgent(addConnectionTargetAgentId), [addConnectionTargetAgentId, readDefinitionsForAgent]);
  const defaultOpenAiAuthJsonPath = useMemo(() => readCodexAuthJsonPath(settingsState?.advanced.agentHomes), [settingsState?.advanced.agentHomes]);
  const repairUsageConnection = settingsState?.connections.find((connection) => connection.id === repairUsageConnectionId) ?? null;
  const selectedConnectionContextAgent = settingsState?.agents.find((agent) => agent.agentId === selectedConnectionContextAgentId) ?? null;
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
  const updatePromptKey = useMemo(
    () => releaseInfo
      ? `${releaseInfo.status}:${releaseInfo.availableVersion ?? ""}:${releaseInfo.errorMessage ?? ""}`
      : null,
    [releaseInfo],
  );
  const shouldShowUpdatePrompt = releaseInfo !== null
    && (releaseInfo.status === "ready" || releaseInfo.status === "error")
    && updatePromptKey !== dismissedUpdatePromptKey;
  const {
    credentialStorageState,
    isUnlockEncryptedLocalStorageDialogOpen,
    isUnlockingEncryptedLocalStorage,
    refreshCredentialStorageState,
    requestEncryptedLocalUnlock,
    setUnlockEncryptedLocalStorageDialogOpen,
    unlockEncryptedLocalStorageHint,
    unlockEncryptedLocalStorage,
    unlockEncryptedLocalStorageError,
  } = useCredentialStorageSession({
    onActionError: setActionError,
    t,
  });

  useEffect(() => {
    setDismissedUpdatePromptKey((current) => (
      current === null || current === updatePromptKey ? current : null
    ));
  }, [updatePromptKey]);

  useEffect(() => {
    void window.nileDesktop.state.refreshMenubar().catch(() => undefined);
  }, [preferences.language, preferences.theme]);

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

  const credentialStorageModeState = readCredentialStorageModeState(
    preferences.credentialStorageMode,
    settingsState.advanced.credentialStorageMode,
    settingsState.advanced.savedConnectionCount > 0,
    settingsState.advanced.credentialStorageModeMixed,
  );
  const credentialStorageMode = credentialStorageModeState.mode;

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
    requestEncryptedLocalUnlock,
  });
  const pageContentProps = useSettingsPageContentProps({
    addConnection,
    addConnectionDefinitions,
    addConnectionTargetAgentId,
    bindCursorUsage,
    canConfigureAgent,
    closeAddConnectionPage,
    completeQuickSetup,
    credentialStorageMode,
    credentialStorageModeState,
    credentialStorageState,
    defaultOpenAiAuthJsonPath,
    definitions,
    historyState,
    importCurrentConnection,
    isLoadedMenubarDisplay: isMenubarDisplayLoaded,
    isLoadedNotificationMute: isNotificationMuteLoaded,
    isLoadingNotificationHistory,
    isMarkingNotificationHistoryRead,
    isResetting,
    isSavingMenubarDisplay,
    isSavingNotificationMute,
    isSavingProfileFeature,
    language: preferences.language,
    markNotificationHistoryRead,
    markNotificationHistoryReadByFilter,
    menubarDisplayMode,
    notificationHistoryConnections,
    notificationHistoryFilter,
    notificationHistoryState,
    notificationsMuted,
    openAddConnectionPage,
    openConnection,
    openNotificationTarget,
    openQuickSetup,
    prepareConnectionDraft,
    preferences,
    profileError,
    profileFeatureEnabled,
    profiles,
    refresh,
    refreshCredentialStorageState,
    refreshProfiles,
    releaseInfo,
    reload,
    reloadNotificationHistory,
    removeConnection,
    requestEncryptedLocalUnlock,
    resetDialogs: () => setResetDialogOpen(true),
    rollbackAgent,
    savePreparedConnection,
    selectedAgentDetailId,
    selectedAgentDetailTab,
    selectedConnectionContextAgent,
    selectedConnectionId,
    selectedProfileId,
    setActionError,
    setCurrentPage,
    setNotificationHistoryFilter,
    setPreferences,
    setRepairUsageConnectionId,
    setSelectedAgentDetailId,
    setSelectedAgentDetailTab,
    setSelectedConnectionContextAgentId,
    setSelectedConnectionId,
    setSelectedProfileId,
    settingsState,
    showProfiles,
    showQuickSetupNav,
    t,
    updateConnection,
    useConnection,
    useExistingConnectionForAgent,
    visiblePage,
    windowActions: {
      checkForUpdates: async () => {
        await window.nileDesktop.updates.checkForUpdates().catch(() => ({ status: "unavailable" as const }));
      },
      createConnectionAlert: async (input) => {
        await window.nileDesktop.connections.createUsageAlert(input);
        await reload();
      },
      deleteConnectionAlert: async (connectionId, alertId) => {
        await window.nileDesktop.connections.deleteUsageAlert(connectionId, alertId);
        await reload();
      },
      languageChange: (language) => setPreferences((current) => ({ ...current, language })),
      openProvidersLink: async (url) => {
        await window.nileDesktop.app.openExternalUrl(url);
      },
      profileApply: async (profileId) => {
        await window.nileDesktop.profiles.applyProfile(profileId);
      },
      profileCreate: async (name, emoji, assignments: WorkspaceProfileAssignment[]) => {
        const profile = await window.nileDesktop.profiles.createProfile(name, emoji, assignments);
        await refreshProfiles();
        return profile.id;
      },
      profileDelete: async (profileId) => {
        await window.nileDesktop.profiles.deleteProfile(profileId);
      },
      profileFeatureEnabledChange: setProfileFeatureEnabled,
      profileSave: async (profileId, name, emoji, assignments) => {
        await window.nileDesktop.profiles.updateProfile(profileId, name, emoji, assignments);
      },
      saveAgentHome: async (agentId, path) => {
        await window.nileDesktop.app.updateAgentHome(agentId, path);
      },
      saveAgentRuntimeCommand: async (agentId, path) => {
        await window.nileDesktop.app.updateAgentRuntimeCommand(agentId, path);
      },
      setMenubarDisplayMode,
      setNotificationsMuted,
      themeChange: (theme) => setPreferences((current) => ({ ...current, theme })),
      updateAgentConnectionModel: async (agentId, connectionId, modelId) => {
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
      },
      updateConnectionAlert: async (input) => {
        await window.nileDesktop.connections.updateUsageAlert(input);
        await reload();
      },
    },
  });

  return (
    <SettingsChrome
      currentPage={currentPage}
      error={actionError ?? error}
      hasUnreadNotifications={hasUnreadNotifications}
      isEncryptedLocalLocked={
        credentialStorageState.encryptedLocalVaultExists && !credentialStorageState.encryptedLocalUnlocked
      }
      isSidebarOpen={sidebarOpen}
      currentProfileEmoji={currentProfile?.emoji ?? ""}
      currentProfileName={currentProfile?.name ?? null}
      showAgents={showAgents}
      showConnections={showConnections}
      showProfiles={showProfiles}
      showQuickSetup={showQuickSetupNav}
      t={t}
      onOpenAbout={() => setNileDialogOpen(true)}
      onOpenEncryptedLocalUnlock={() => {
        void requestEncryptedLocalUnlock().catch(() => undefined);
      }}
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
      <EncryptedLocalAccessProvider requestUnlock={requestEncryptedLocalUnlock}>
        <SettingsPageContent {...pageContentProps} />
      </EncryptedLocalAccessProvider>

      <SettingsDialogs
        isResetDialogOpen={resetDialogOpen}
        isResetting={isResetting}
        isSupportOpen={nileDialogOpen}
        isUnlockEncryptedLocalStorageDialogOpen={isUnlockEncryptedLocalStorageDialogOpen}
        isUnlockingEncryptedLocalStorage={isUnlockingEncryptedLocalStorage}
        repairUsageConnection={repairUsageConnection}
        reusedConnectionDialog={reusedConnectionDialog}
        t={t}
        unlockEncryptedLocalStorageError={unlockEncryptedLocalStorageError}
        unlockEncryptedLocalStorageHint={unlockEncryptedLocalStorageHint}
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
        onSetUnlockEncryptedLocalStorageDialogOpen={setUnlockEncryptedLocalStorageDialogOpen}
        onUnlockEncryptedLocalStorage={unlockEncryptedLocalStorage}
      />

      {shouldShowUpdatePrompt ? (
        <UpdatePrompt
          info={releaseInfo}
          t={t}
          onCheck={async () => {
            await window.nileDesktop.updates.checkForUpdates().catch(() => ({ status: "unavailable" as const }));
          }}
          onDismiss={() => {
            if (updatePromptKey) {
              setDismissedUpdatePromptKey(updatePromptKey);
            }
          }}
          onInstall={async () => {
            await window.nileDesktop.updates.installUpdate().catch(() => ({ status: "unavailable" as const }));
          }}
          onOpenReleaseNotes={async () => {
            if (!releaseInfo?.availableVersion) {
              return;
            }
            await window.nileDesktop.app.openExternalUrl(
              `https://github.com/vestin-io/Nile/releases/tag/v${releaseInfo.availableVersion}`,
            );
          }}
        />
      ) : null}
    </SettingsChrome>
  );
}
