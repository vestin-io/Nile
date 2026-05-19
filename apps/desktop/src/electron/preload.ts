import { contextBridge, ipcRenderer } from "electron";

import type { DesktopNotificationTarget } from "./notifications/contracts";
import type { DesktopBridge } from "./Bridge";

const bridge: DesktopBridge = {
  app: {
    openGitHubIssues: () => ipcRenderer.invoke("desktop:open-github-issues"),
    openExternalUrl: (url) => ipcRenderer.invoke("desktop:open-external-url", url),
    openSettings: () => ipcRenderer.invoke("desktop:open-settings"),
    openSupportEmail: () => ipcRenderer.invoke("desktop:open-support-email"),
    updateAgentHome: (agentId, path) => ipcRenderer.invoke("desktop:update-agent-home", agentId, path),
  },
  connections: {
    listConnectionDefinitions: () => ipcRenderer.invoke("desktop:list-connection-definitions"),
    chooseOpenAiAuthJsonPath: (defaultPath) => ipcRenderer.invoke("desktop:choose-openai-auth-json-path", defaultPath),
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
    importDetectedSetups: (scanIds) => ipcRenderer.invoke("desktop:import-detected-setups", scanIds),
    importCurrentConnection: (agentId) => ipcRenderer.invoke("desktop:import-current-connection", agentId),
    removeConnection: (connectionId) => ipcRenderer.invoke("desktop:remove-connection", connectionId),
    updateAgentConnectionModel: (input) => ipcRenderer.invoke("desktop:update-agent-connection-model", input),
    bindCursorUsage: (connectionId, sessionToken) => ipcRenderer.invoke("desktop:bind-cursor-usage", connectionId, sessionToken),
    createUsageAlert: (input) => ipcRenderer.invoke("desktop:create-connection-usage-alert", input),
    updateUsageAlert: (input) => ipcRenderer.invoke("desktop:update-connection-usage-alert", input),
    deleteUsageAlert: (connectionId, alertId) => ipcRenderer.invoke("desktop:delete-connection-usage-alert", connectionId, alertId),
    resetState: () => ipcRenderer.invoke("desktop:reset-state"),
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
  state: {
    getMenubarState: () => ipcRenderer.invoke("desktop:get-menubar-state"),
    getMenubarDisplay: () => ipcRenderer.invoke("desktop:get-menubar-display"),
    getSettingsState: () => ipcRenderer.invoke("desktop:get-settings-state"),
    getSettingsStateSnapshot: () => ipcRenderer.invoke("desktop:get-settings-state-snapshot"),
    getHistoryState: () => ipcRenderer.invoke("desktop:get-history-state"),
    getNotificationHistory: (filter) => ipcRenderer.invoke("desktop:get-notification-history", filter),
    getNotificationHistoryConnections: (filter) => ipcRenderer.invoke("desktop:get-notification-history-connections", filter),
    hasUnreadNotifications: () => ipcRenderer.invoke("desktop:has-unread-notifications"),
    markNotificationHistoryRead: (entryIds) => ipcRenderer.invoke("desktop:mark-notification-history-read", entryIds),
    markNotificationHistoryReadByFilter: (filter) => ipcRenderer.invoke("desktop:mark-notification-history-read-by-filter", filter),
    setLanguagePreference: (language) => ipcRenderer.invoke("desktop:set-language-preference", language),
    getNotificationsMuted: () => ipcRenderer.invoke("desktop:get-notifications-muted"),
    getProfileFeatureEnabled: () => ipcRenderer.invoke("desktop:get-profile-feature-enabled"),
    setMenubarDisplayMode: (mode) => ipcRenderer.invoke("desktop:set-menubar-display-mode", mode),
    setNotificationsMuted: (muted) => ipcRenderer.invoke("desktop:set-notifications-muted", muted),
    toggleMenubarTickerAgent: (agentId) => ipcRenderer.invoke("desktop:toggle-menubar-ticker-agent", agentId),
    setProfileFeatureEnabled: (enabled) => ipcRenderer.invoke("desktop:set-profile-feature-enabled", enabled),
    refreshSettings: () => ipcRenderer.invoke("desktop:refresh-settings"),
    refreshMenubar: () => ipcRenderer.invoke("desktop:refresh-menubar"),
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
  onNotificationTarget(callback: (target: DesktopNotificationTarget) => void) {
    const listener = (_event: Electron.IpcRendererEvent, target: DesktopNotificationTarget) => callback(target);
    ipcRenderer.on("desktop:notification-target", listener);
    return () => {
      ipcRenderer.removeListener("desktop:notification-target", listener);
    };
  },
});
