import { contextBridge, ipcRenderer } from "electron";

import type { DesktopNotificationTarget } from "./notifications/contracts";
import type { DesktopBridge } from "./Bridge";

const bridge: DesktopBridge = {
  app: {
    openGitHubIssues: () => ipcRenderer.invoke("desktop:open-github-issues"),
    openExternalUrl: (url) => ipcRenderer.invoke("desktop:open-external-url", url),
    openSettings: () => ipcRenderer.invoke("desktop:open-settings"),
    quit: () => ipcRenderer.invoke("desktop:quit-app"),
    openSupportEmail: () => ipcRenderer.invoke("desktop:open-support-email"),
    updateAgentHome: (agentId, path) => ipcRenderer.invoke("desktop:update-agent-home", agentId, path),
    updateAgentRuntimeCommand: (agentId, path) => ipcRenderer.invoke("desktop:update-agent-runtime-command", agentId, path),
  },
  connections: {
    listConnectionDefinitions: () => ipcRenderer.invoke("desktop:list-connection-definitions"),
    getCredentialStorageState: () => ipcRenderer.invoke("desktop:get-credential-storage-state"),
    getCredentialStorageModeState: () => ipcRenderer.invoke("desktop:get-credential-storage-mode-state"),
    unlockEncryptedLocalStorage: (passphrase) => ipcRenderer.invoke("desktop:unlock-encrypted-local-storage", passphrase),
    chooseOpenAiAuthJsonPath: (defaultPath) => ipcRenderer.invoke("desktop:choose-openai-auth-json-path", defaultPath),
    chooseCredentialExportPath: (defaultFileName) => ipcRenderer.invoke("desktop:choose-credential-export-path", defaultFileName),
    chooseCredentialImportPath: (defaultPath) => ipcRenderer.invoke("desktop:choose-credential-import-path", defaultPath),
    previewCredentialExport: (input) => ipcRenderer.invoke("desktop:preview-credential-export", input),
    exportCredentialBundle: (input) => ipcRenderer.invoke("desktop:export-credential-bundle", input),
    previewCredentialImport: (input) => ipcRenderer.invoke("desktop:preview-credential-import", input),
    applyCredentialImport: (input) => ipcRenderer.invoke("desktop:apply-credential-import", input),
    describeConnectionOnboarding: (input) => ipcRenderer.invoke("desktop:describe-connection-onboarding", input),
    describeSavedConnectionOnboarding: (input) => ipcRenderer.invoke("desktop:describe-saved-connection-onboarding", input),
    getConnectionModelCatalog: (input) => ipcRenderer.invoke("desktop:get-connection-model-catalog", input),
    prepareConnectionDraft: (input) => ipcRenderer.invoke("desktop:prepare-connection-draft", input),
    savePreparedConnection: (input) => ipcRenderer.invoke("desktop:save-prepared-connection", input),
    discardPreparedConnectionDraft: (input) => ipcRenderer.invoke("desktop:discard-prepared-connection-draft", input),
    switchConnection: (agentId, connectionId) => ipcRenderer.invoke("desktop:switch-connection", agentId, connectionId),
    rollbackLatestMutation: (agentId) => ipcRenderer.invoke("desktop:rollback-latest-mutation", agentId),
    addConnection: (input) => ipcRenderer.invoke("desktop:add-connection", input),
    updateConnection: (input) => ipcRenderer.invoke("desktop:update-connection", input),
    importCurrentConnection: (input) => ipcRenderer.invoke("desktop:import-current-connection", input),
    removeConnection: (connectionId) => ipcRenderer.invoke("desktop:remove-connection", connectionId),
    updateAgentConnectionModel: (input) => ipcRenderer.invoke("desktop:update-agent-connection-model", input),
    bindCursorUsage: (connectionId, sessionToken) => ipcRenderer.invoke("desktop:bind-cursor-usage", connectionId, sessionToken),
    createUsageAlert: (input) => ipcRenderer.invoke("desktop:create-connection-usage-alert", input),
    updateUsageAlert: (input) => ipcRenderer.invoke("desktop:update-connection-usage-alert", input),
    deleteUsageAlert: (connectionId, alertId) => ipcRenderer.invoke("desktop:delete-connection-usage-alert", connectionId, alertId),
    resetState: () => ipcRenderer.invoke("desktop:reset-state"),
  },
  notifications: {
    getNotificationsMuted: () => ipcRenderer.invoke("desktop:get-notifications-muted"),
    hasUnreadNotifications: () => ipcRenderer.invoke("desktop:has-unread-notifications"),
    getNotificationHistory: (filter) => ipcRenderer.invoke("desktop:get-notification-history", filter),
    getNotificationHistoryConnections: (filter) => ipcRenderer.invoke("desktop:get-notification-history-connections", filter),
    markNotificationHistoryRead: (entryIds) => ipcRenderer.invoke("desktop:mark-notification-history-read", entryIds),
    markNotificationHistoryReadByFilter: (filter) => ipcRenderer.invoke("desktop:mark-notification-history-read-by-filter", filter),
    setNotificationsMuted: (muted) => ipcRenderer.invoke("desktop:set-notifications-muted", muted),
  },
  preferences: {
    getDesktopPreferences: () => ipcRenderer.invoke("desktop:get-desktop-preferences"),
    migrateDesktopPreferences: (raw) => ipcRenderer.invoke("desktop:migrate-desktop-preferences", raw),
    setDesktopPreferences: (preferences) => ipcRenderer.invoke("desktop:set-desktop-preferences", preferences),
    setLanguagePreference: (language) => ipcRenderer.invoke("desktop:set-language-preference", language),
  },
  profiles: {
    listProfiles: () => ipcRenderer.invoke("desktop:list-workspace-profiles"),
    createProfile: (name, emoji, assignments) => ipcRenderer.invoke("desktop:create-workspace-profile", name, emoji, assignments),
    updateProfile: (profileId, name, emoji, assignments) => (
      ipcRenderer.invoke("desktop:update-workspace-profile", profileId, name, emoji, assignments)
    ),
    deleteProfile: (profileId) => ipcRenderer.invoke("desktop:delete-workspace-profile", profileId),
    applyProfile: (profileId) => ipcRenderer.invoke("desktop:apply-workspace-profile", profileId),
  },
  profileFeatures: {
    getProfileFeatureEnabled: () => ipcRenderer.invoke("desktop:get-profile-feature-enabled"),
    setProfileFeatureEnabled: (enabled) => ipcRenderer.invoke("desktop:set-profile-feature-enabled", enabled),
  },
  settingsData: {
    getSettingsState: () => ipcRenderer.invoke("desktop:get-settings-state"),
    getSettingsStateSnapshot: () => ipcRenderer.invoke("desktop:get-settings-state-snapshot"),
    getHistoryState: () => ipcRenderer.invoke("desktop:get-history-state"),
    refreshSettings: () => ipcRenderer.invoke("desktop:refresh-settings"),
  },
  statusEntry: {
    getStatusEntryState: () => ipcRenderer.invoke("desktop:get-status-entry-state"),
    getStatusEntryDisplay: () => ipcRenderer.invoke("desktop:get-status-entry-display"),
    setStatusEntryDisplayMode: (mode) => ipcRenderer.invoke("desktop:set-status-entry-display-mode", mode),
    toggleStatusEntrySelectedAgent: (agentId) => ipcRenderer.invoke("desktop:toggle-status-entry-selected-agent", agentId),
    refreshStatusEntry: () => ipcRenderer.invoke("desktop:refresh-status-entry"),
  },
  updates: {
    getReleaseInfo: () => ipcRenderer.invoke("desktop:get-release-info"),
    checkForUpdates: () => ipcRenderer.invoke("desktop:check-for-updates"),
    installUpdate: () => ipcRenderer.invoke("desktop:install-update"),
  },
};

contextBridge.exposeInMainWorld("nileDesktop", bridge);
contextBridge.exposeInMainWorld("nileDesktopEvents", {
  onNotificationHistoryChanged(callback: () => void) {
    const listener = () => callback();
    ipcRenderer.on("desktop:notification-history-changed", listener);
    return () => {
      ipcRenderer.removeListener("desktop:notification-history-changed", listener);
    };
  },
  onStateChanged(callback: () => void) {
    const listener = () => callback();
    ipcRenderer.on("desktop:state-changed", listener);
    return () => {
      ipcRenderer.removeListener("desktop:state-changed", listener);
    };
  },
  onPreferencesChanged(callback: () => void) {
    const listener = () => callback();
    ipcRenderer.on("desktop:preferences-changed", listener);
    return () => {
      ipcRenderer.removeListener("desktop:preferences-changed", listener);
    };
  },
  onLocalStateReset(callback: () => void) {
    const listener = () => callback();
    ipcRenderer.on("desktop:local-state-reset", listener);
    return () => {
      ipcRenderer.removeListener("desktop:local-state-reset", listener);
    };
  },
  onNotificationTarget(callback: (target: DesktopNotificationTarget) => void) {
    const listener = (_event: Electron.IpcRendererEvent, target: DesktopNotificationTarget) => callback(target);
    ipcRenderer.on("desktop:notification-target", listener);
    return () => {
      ipcRenderer.removeListener("desktop:notification-target", listener);
    };
  },
});
