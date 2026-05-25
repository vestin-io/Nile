import type { AgentId } from "@nile/core/models/agent/definitions";
import type { CredentialStorageBackend } from "@nile/core/services/credential";

import type { WorkspaceProfileAssignment } from "../../profiles/useProfiles";
import type { SettingsPageContentProps } from "./PageContent";
import type { NotificationHistoryFilter } from "./useNavigation";
import type { AgentDetailTab } from "../../agents/detail/Page";
import type { DesktopNotificationTarget } from "../../../electron/notifications/contracts";

type UseSettingsPageContentPropsOptions = {
  addConnectionDefinitions: SettingsPageContentProps["addConnectionDefinitions"];
  addConnectionTargetAgentId: SettingsPageContentProps["addConnectionTargetAgentId"];
  canConfigureAgent: SettingsPageContentProps["canConfigureAgent"];
  credentialStorageMode: CredentialStorageBackend | null;
  credentialStorageState: SettingsPageContentProps["credentialStorageState"];
  credentialStorageModeState: {
    isLocked: boolean;
    isMixed: boolean;
  };
  defaultOpenAiAuthJsonPath: string;
  definitions: SettingsPageContentProps["definitions"];
  historyState: SettingsPageContentProps["historyState"];
  isLoadedStatusEntryDisplay: boolean;
  isLoadedNotificationMute: boolean;
  isLoadingNotificationHistory: boolean;
  isMarkingNotificationHistoryRead: boolean;
  isResetting: boolean;
  isSavingStatusEntryDisplay: boolean;
  isSavingNotificationMute: boolean;
  isSavingProfileFeature: boolean;
  language: SettingsPageContentProps["language"];
  statusEntryDisplayMode: SettingsPageContentProps["statusEntryDisplayMode"];
  markNotificationHistoryRead: SettingsPageContentProps["onMarkNotificationHistoryRead"];
  markNotificationHistoryReadByFilter: SettingsPageContentProps["onMarkNotificationHistoryReadByFilter"];
  notificationHistoryConnections: SettingsPageContentProps["notificationHistoryConnections"];
  notificationHistoryFilter: NotificationHistoryFilter;
  notificationHistoryState: SettingsPageContentProps["notificationHistoryState"];
  notificationsMuted: boolean;
  preferences: SettingsPageContentProps["preferences"];
  profileError: string | null;
  profileFeatureEnabled: boolean;
  profiles: SettingsPageContentProps["profiles"];
  releaseInfo: SettingsPageContentProps["releaseInfo"];
  selectedAgentDetailId: AgentId | null;
  selectedAgentDetailTab: AgentDetailTab;
  selectedConnectionContextAgent: SettingsPageContentProps["selectedConnectionContextAgent"];
  selectedConnectionId: string | null;
  selectedProfileId: string | null;
  settingsState: SettingsPageContentProps["settingsState"];
  showProfiles: boolean;
  showQuickSetupNav: boolean;
  t: SettingsPageContentProps["t"];
  visiblePage: SettingsPageContentProps["visiblePage"];
  addConnection: SettingsPageContentProps["onAddConnection"];
  bindCursorUsage: SettingsPageContentProps["onBindCursorUsage"];
  closeAddConnectionPage: SettingsPageContentProps["onCloseAddConnectionPage"];
  completeQuickSetup: SettingsPageContentProps["onCompleteQuickSetup"];
  importCurrentConnection: SettingsPageContentProps["onQuickSetupSaveAgent"];
  openAddConnectionPage(agentId?: AgentId | null): void;
  openConnection: SettingsPageContentProps["onOpenConnection"];
  openNotificationTarget(target: DesktopNotificationTarget): void;
  openQuickSetup(): void;
  prepareConnectionDraft: SettingsPageContentProps["onPrepareConnectionDraft"];
  refresh: SettingsPageContentProps["onRefresh"];
  refreshCredentialStorageState: SettingsPageContentProps["onRefreshCredentialStorageState"];
  refreshProfiles(): Promise<void>;
  reload(): Promise<void>;
  reloadNotificationHistory: SettingsPageContentProps["onRefreshNotificationHistory"];
  removeConnection: SettingsPageContentProps["onRemoveConnection"];
  requestEncryptedLocalUnlock(reason?: string): Promise<void>;
  resetDialogs(): void;
  rollbackAgent: SettingsPageContentProps["onRollbackAgent"];
  savePreparedConnection: SettingsPageContentProps["onSavePreparedConnection"];
  setActionError(message: string | null): void;
  setCurrentPage(page: SettingsPageContentProps["visiblePage"]): void;
  setNotificationHistoryFilter(filter: NotificationHistoryFilter): void;
  setPreferences(updater: (current: SettingsPageContentProps["preferences"]) => SettingsPageContentProps["preferences"]): void;
  setRepairUsageConnectionId(connectionId: string | null): void;
  setSelectedAgentDetailId(agentId: AgentId | null): void;
  setSelectedAgentDetailTab(tab: AgentDetailTab): void;
  setSelectedConnectionContextAgentId(agentId: AgentId | null): void;
  setSelectedConnectionId(connectionId: string | null): void;
  setSelectedProfileId(profileId: string | null): void;
  updateConnection: SettingsPageContentProps["onUpdateConnection"];
  useConnection: SettingsPageContentProps["onUseConnection"];
  useExistingConnectionForAgent: SettingsPageContentProps["onUseExistingQuickSetupConnection"];
  windowActions: {
    checkForUpdates(): Promise<void>;
    createConnectionAlert: SettingsPageContentProps["onCreateConnectionAlert"];
    deleteConnectionAlert: SettingsPageContentProps["onDeleteConnectionAlert"];
    languageChange(language: SettingsPageContentProps["language"]): void;
    openProvidersLink(url: string): Promise<void>;
    profileApply(profileId: string): Promise<void>;
    profileCreate(name: string, emoji: string, assignments: WorkspaceProfileAssignment[]): Promise<string>;
    profileDelete(profileId: string): Promise<void>;
    profileFeatureEnabledChange(enabled: boolean): Promise<void>;
    profileSave(profileId: string, name: string, emoji: string, assignments: WorkspaceProfileAssignment[]): Promise<void>;
    saveAgentHome(agentId: AgentId, path: string | null): Promise<void>;
    saveAgentRuntimeCommand(agentId: AgentId, path: string | null): Promise<void>;
    setStatusEntryDisplayMode(mode: SettingsPageContentProps["statusEntryDisplayMode"]): Promise<void>;
    setNotificationsMuted(muted: boolean): Promise<void>;
    themeChange(theme: SettingsPageContentProps["preferences"]["theme"]): void;
    updateAgentConnectionModel(agentId: AgentId, connectionId: string, modelId: string | null): Promise<void>;
    updateConnectionAlert: SettingsPageContentProps["onUpdateConnectionAlert"];
  };
};

export function useSettingsPageContentProps(
  input: UseSettingsPageContentPropsOptions,
): SettingsPageContentProps {
  return {
    addConnectionDefinitions: input.addConnectionDefinitions,
    addConnectionTargetAgentId: input.addConnectionTargetAgentId,
    canConfigureAgent: input.canConfigureAgent,
    credentialStorageMode: input.credentialStorageMode,
    credentialStorageState: input.credentialStorageState,
    defaultOpenAiAuthJsonPath: input.defaultOpenAiAuthJsonPath,
    definitions: input.definitions,
    historyState: input.historyState,
    isCredentialStorageModeLocked: input.credentialStorageModeState.isLocked,
    isCredentialStorageModeMixed: input.credentialStorageModeState.isMixed,
    isLoadedStatusEntryDisplay: input.isLoadedStatusEntryDisplay,
    isLoadedNotificationMute: input.isLoadedNotificationMute,
    isLoadingNotificationHistory: input.isLoadingNotificationHistory,
    isMarkingNotificationHistoryRead: input.isMarkingNotificationHistoryRead,
    isResetting: input.isResetting,
    isSavingStatusEntryDisplay: input.isSavingStatusEntryDisplay,
    isSavingNotificationMute: input.isSavingNotificationMute,
    isSavingProfileFeature: input.isSavingProfileFeature,
    language: input.language,
    statusEntryDisplayMode: input.statusEntryDisplayMode,
    notificationHistoryConnections: input.notificationHistoryConnections,
    notificationHistoryFilter: input.notificationHistoryFilter,
    notificationHistoryState: input.notificationHistoryState,
    notificationsMuted: input.notificationsMuted,
    preferences: input.preferences,
    profileError: input.profileError,
    profileFeatureEnabled: input.profileFeatureEnabled,
    profiles: input.profiles,
    releaseInfo: input.releaseInfo,
    selectedAgentDetailId: input.selectedAgentDetailId,
    selectedAgentDetailTab: input.selectedAgentDetailTab,
    selectedConnectionContextAgent: input.selectedConnectionContextAgent,
    selectedConnectionId: input.selectedConnectionId,
    selectedProfileId: input.selectedProfileId,
    settingsState: input.settingsState,
    showProfiles: input.showProfiles,
    showQuickSetupNav: input.showQuickSetupNav,
    t: input.t,
    visiblePage: input.visiblePage,
    onAddConnection: input.addConnection,
    onAgentOrderChange: (agentOrder) => input.setPreferences((current) => ({ ...current, agentOrder })),
    onApplyProfile: async (profileId) => {
      await input.windowActions.profileApply(profileId);
      await input.refresh();
    },
    onBackFromAgentDetail: () => input.setCurrentPage("agents"),
    onBindCursorUsage: input.bindCursorUsage,
    onCheckForUpdates: input.windowActions.checkForUpdates,
    onCloseAddConnectionPage: input.closeAddConnectionPage,
    onCompleteQuickSetup: input.completeQuickSetup,
    onConfigureAgent: (agentId) => input.openAddConnectionPage(agentId),
    onConfirmImportAgent: async (agentId) => {
      if (input.credentialStorageModeState.isMixed) {
        input.setCurrentPage("settings");
        input.setActionError(input.t("settings.credentialStorage.mixedError"));
        return;
      }
      const credentialStorageBackend = input.credentialStorageMode ?? undefined;
      if (!credentialStorageBackend) {
        input.setPreferences((current) => ({ ...current, quickSetupDismissed: false }));
        input.setCurrentPage("quick-setup");
        return;
      }
      if (
        credentialStorageBackend === "encrypted_local_storage"
        && input.credentialStorageState.encryptedLocalVaultExists
        && !input.credentialStorageState.encryptedLocalUnlocked
      ) {
        await input.requestEncryptedLocalUnlock(input.t("dialog.encryptedLocalUnlock.reasonSaveLocalSetup"));
      }
      await input.importCurrentConnection(agentId, {
        credentialStorageBackend,
      });
    },
    onCreateConnectionAlert: async (alertInput) => {
      await input.windowActions.createConnectionAlert(alertInput);
      await input.reload();
    },
    onCreateProfile: input.windowActions.profileCreate,
    onDeleteConnectionAlert: async (connectionId, alertId) => {
      await input.windowActions.deleteConnectionAlert(connectionId, alertId);
      await input.reload();
    },
    onDeleteProfile: async (profileId) => {
      await input.windowActions.profileDelete(profileId);
      await input.refreshProfiles();
    },
    onInstallUpdate: async () => {
      await window.nileDesktop.updates.installUpdate().catch(() => ({ status: "unavailable" as const }));
    },
    onLanguageChange: input.windowActions.languageChange,
    onMarkNotificationHistoryRead: input.markNotificationHistoryRead,
    onMarkNotificationHistoryReadByFilter: input.markNotificationHistoryReadByFilter,
    onStatusEntryDisplayModeChange: input.windowActions.setStatusEntryDisplayMode,
    onNotificationHistoryFilterChange: (filter) => {
      input.setNotificationHistoryFilter(filter);
      input.setCurrentPage("notifications");
    },
    onNotificationsMutedChange: input.windowActions.setNotificationsMuted,
    onOpenAddConnection: () => {
      if (input.credentialStorageModeState.isMixed) {
        input.setCurrentPage("settings");
        input.setActionError(input.t("settings.credentialStorage.mixedError"));
        return;
      }
      input.openAddConnectionPage();
    },
    onOpenConnection: input.openConnection,
    onOpenNotificationTarget: input.openNotificationTarget,
    onOpenProvidersLink: input.windowActions.openProvidersLink,
    onOpenQuickSetup: () => {
      if (input.credentialStorageModeState.isMixed) {
        input.setCurrentPage("settings");
        input.setActionError(input.t("settings.credentialStorage.mixedError"));
        return;
      }
      input.openQuickSetup();
    },
    onOpenQuickSetupModelSetup: (agentId) => {
      input.setSelectedAgentDetailId(agentId);
      input.setSelectedAgentDetailTab("connections");
      input.setCurrentPage("agents");
    },
    onPrepareConnectionDraft: input.prepareConnectionDraft,
    onProfileFeatureEnabledChange: input.windowActions.profileFeatureEnabledChange,
    onQuickSetupSaveAgent: input.importCurrentConnection,
    onRefresh: input.refresh,
    onRefreshCredentialStorageState: input.refreshCredentialStorageState,
    onRefreshNotificationHistory: input.reloadNotificationHistory,
    onRememberCredentialStorageMode: (backend) => input.setPreferences((current) => ({
      ...current,
      credentialStorageMode: backend,
    })),
    onRemoveConnection: input.removeConnection,
    onReset: input.resetDialogs,
    onRollbackAgent: input.rollbackAgent,
    onSavePreparedConnection: input.savePreparedConnection,
    onSaveProfile: async (profileId, name, emoji, assignments) => {
      await input.windowActions.profileSave(profileId, name, emoji, assignments);
      await input.refreshProfiles();
    },
    onSelectAgentDetail: (agentId) => {
      input.setSelectedAgentDetailId(agentId);
      if (!agentId) {
        input.setSelectedAgentDetailTab("connections");
      }
    },
    onSelectAgentDetailTab: input.setSelectedAgentDetailTab,
    onSelectConnection: input.setSelectedConnectionId,
    onSelectConnectionContextAgent: input.setSelectedConnectionContextAgentId,
    onSelectProfile: input.setSelectedProfileId,
    onThemeChange: input.windowActions.themeChange,
    onUpdateAgentConnectionModel: input.windowActions.updateAgentConnectionModel,
    onUpdateAgentHome: input.windowActions.saveAgentHome,
    onUpdateAgentRuntimeCommand: input.windowActions.saveAgentRuntimeCommand,
    onUpdateConnection: input.updateConnection,
    onUpdateConnectionAlert: input.windowActions.updateConnectionAlert,
    onUseConnection: input.useConnection,
    onUseExistingQuickSetupConnection: input.useExistingConnectionForAgent,
  };
}
