import type { AgentId } from "@nile/core/models/agent";
import type { CredentialStorageBackend } from "@nile/core/services/credential";

import type { SettingsPageContentProps } from "./PageContentProps";
import type { NotificationHistoryFilter } from "./useNavigation";
import type { AgentDetailTab } from "../../agents/detail/Page";
import type { DesktopNotificationTarget } from "../../../electron/notifications/contracts";
import type { SettingsWindowActions } from "./useWindowActions";

export type SettingsPageContentBuilderOptions = {
  addConnectionDefinitions: SettingsPageContentProps["addConnectionDefinitions"];
  addConnectionTargetAgentId: SettingsPageContentProps["addConnectionTargetAgentId"];
  canConfigureAgent: SettingsPageContentProps["canConfigureAgent"];
  credentialStorageMode: CredentialStorageBackend | null;
  credentialStorageState: SettingsPageContentProps["credentialStorageState"];
  credentialStorageModeState: {
    isLocked: boolean;
    isMixed: boolean;
  };
  isCredentialPortabilityBusy: boolean;
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
  reloadNotificationHistory: SettingsPageContentProps["onRefreshNotificationHistory"];
  removeConnection: SettingsPageContentProps["onRemoveConnection"];
  requestEncryptedLocalUnlock(reason?: string): Promise<void>;
  resetDialogs(): void;
  rollbackAgent: SettingsPageContentProps["onRollbackAgent"];
  savePreparedConnection: SettingsPageContentProps["onSavePreparedConnection"];
  setActionError(message: string | null): void;
  setCurrentPage(page: SettingsPageContentProps["visiblePage"]): void;
  setNotificationHistoryFilter(filter: NotificationHistoryFilter): void;
  setPreferences(
    updater: (current: SettingsPageContentProps["preferences"]) => SettingsPageContentProps["preferences"],
  ): void;
  setSelectedAgentDetailId(agentId: AgentId | null): void;
  setSelectedAgentDetailTab(tab: AgentDetailTab): void;
  setSelectedConnectionContextAgentId(agentId: AgentId | null): void;
  setSelectedConnectionId(connectionId: string | null): void;
  setSelectedProfileId(profileId: string | null): void;
  updateConnection: SettingsPageContentProps["onUpdateConnection"];
  useConnection: SettingsPageContentProps["onUseConnection"];
  useExistingConnectionForAgent: SettingsPageContentProps["onUseExistingQuickSetupConnection"];
  windowActions: SettingsWindowActions;
};

export function readSettingsPageContentActions(
  input: SettingsPageContentBuilderOptions,
): Pick<
  SettingsPageContentProps,
  | "onAddConnection"
  | "onAgentOrderChange"
  | "onApplyProfile"
  | "onBackFromAgentDetail"
  | "onBindCursorUsage"
  | "onCheckForUpdates"
  | "onCloseAddConnectionPage"
  | "onCompleteQuickSetup"
  | "onConfigureAgent"
  | "onConfirmImportAgent"
  | "onCreateConnectionAlert"
  | "onCreateProfile"
  | "onDeleteConnectionAlert"
  | "onDeleteProfile"
  | "onExportCredentials"
  | "onInstallUpdate"
  | "onImportCredentials"
  | "onLanguageChange"
  | "onMarkNotificationHistoryRead"
  | "onMarkNotificationHistoryReadByFilter"
  | "onStatusEntryDisplayModeChange"
  | "onNotificationHistoryFilterChange"
  | "onNotificationsMutedChange"
  | "onOpenAddConnection"
  | "onOpenConnection"
  | "onOpenNotificationTarget"
  | "onOpenProvidersLink"
  | "onOpenQuickSetup"
  | "onOpenQuickSetupModelSetup"
  | "onPrepareConnectionDraft"
  | "onProfileFeatureEnabledChange"
  | "onQuickSetupSaveAgent"
  | "onRefresh"
  | "onRefreshCredentialStorageState"
  | "onRefreshNotificationHistory"
  | "onRememberCredentialStorageMode"
  | "onRemoveConnection"
  | "onReset"
  | "onRollbackAgent"
  | "onSavePreparedConnection"
  | "onSaveProfile"
  | "onSelectAgentDetail"
  | "onSelectAgentDetailTab"
  | "onSelectConnection"
  | "onSelectConnectionContextAgent"
  | "onSelectProfile"
  | "onThemeChange"
  | "onUpdateAgentConnectionModel"
  | "onUpdateAgentHome"
  | "onUpdateAgentRuntimeCommand"
  | "onUpdateConnection"
  | "onUpdateConnectionAlert"
  | "onUseConnection"
  | "onUseExistingQuickSetupConnection"
> {
  return {
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
    onCreateConnectionAlert: input.windowActions.createConnectionAlert,
    onCreateProfile: input.windowActions.profileCreate,
    onDeleteConnectionAlert: input.windowActions.deleteConnectionAlert,
    onDeleteProfile: async (profileId) => {
      await input.windowActions.profileDelete(profileId);
      await input.refreshProfiles();
    },
    onExportCredentials: async (selectedConnectionIds) => {
      await input.windowActions.exportCredentials(selectedConnectionIds);
    },
    onInstallUpdate: async () => {
      await window.nileDesktop.updates.installUpdate().catch(() => ({ status: "unavailable" as const }));
    },
    onImportCredentials: async () => {
      await input.windowActions.importCredentials();
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
