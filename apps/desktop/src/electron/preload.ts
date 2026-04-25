import { contextBridge, ipcRenderer } from "electron";

import type { DesktopBridge } from "./types";

const bridge: DesktopBridge = {
  getMenubarState: () => ipcRenderer.invoke("desktop:get-menubar-state"),
  getSettingsState: () => ipcRenderer.invoke("desktop:get-settings-state"),
  getHistoryState: () => ipcRenderer.invoke("desktop:get-history-state"),
  listConnectionDefinitions: () => ipcRenderer.invoke("desktop:list-connection-definitions"),
  chooseOpenAiAuthJsonPath: (defaultPath) => ipcRenderer.invoke("desktop:choose-openai-auth-json-path", defaultPath),
  describeConnectionOnboarding: (input) => ipcRenderer.invoke("desktop:describe-connection-onboarding", input),
  describeSavedConnectionOnboarding: (input) => ipcRenderer.invoke("desktop:describe-saved-connection-onboarding", input),
  prepareConnectionDraft: (input) => ipcRenderer.invoke("desktop:prepare-connection-draft", input),
  savePreparedConnection: (input) => ipcRenderer.invoke("desktop:save-prepared-connection", input),
  switchConnection: (agentId, connectionId) => ipcRenderer.invoke("desktop:switch-connection", agentId, connectionId),
  rollbackLatestMutation: (agentId) => ipcRenderer.invoke("desktop:rollback-latest-mutation", agentId),
  addConnection: (input) => ipcRenderer.invoke("desktop:add-connection", input),
  updateConnection: (input) => ipcRenderer.invoke("desktop:update-connection", input),
  importDetectedSetups: (scanIds) => ipcRenderer.invoke("desktop:import-detected-setups", scanIds),
  importCurrentConnection: (agentId) => ipcRenderer.invoke("desktop:import-current-connection", agentId),
  removeConnection: (connectionId) => ipcRenderer.invoke("desktop:remove-connection", connectionId),
  bindCursorUsage: (connectionId, sessionToken) => ipcRenderer.invoke("desktop:bind-cursor-usage", connectionId, sessionToken),
  resetState: () => ipcRenderer.invoke("desktop:reset-state"),
  openGitHubIssues: () => ipcRenderer.invoke("desktop:open-github-issues"),
  openExternalUrl: (url) => ipcRenderer.invoke("desktop:open-external-url", url),
  openSettings: () => ipcRenderer.invoke("desktop:open-settings"),
  openSupportEmail: () => ipcRenderer.invoke("desktop:open-support-email"),
  refreshSettings: () => ipcRenderer.invoke("desktop:refresh-settings"),
  refreshMenubar: () => ipcRenderer.invoke("desktop:refresh-menubar"),
  updateAgentHome: (agentId, path) => ipcRenderer.invoke("desktop:update-agent-home", agentId, path),
};

contextBridge.exposeInMainWorld("nileDesktop", bridge);
contextBridge.exposeInMainWorld("nileDesktopEvents", {
  onStateChanged(callback: () => void) {
    const listener = () => callback();
    ipcRenderer.on("desktop:state-changed", listener);
    return () => {
      ipcRenderer.removeListener("desktop:state-changed", listener);
    };
  },
});
