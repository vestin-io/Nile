import { ipcMain } from "electron";

import type { AgentId } from "@nile/core/models/agent";

import { DesktopIpcInputValidator } from "./DesktopIpcInputValidator";
import { DesktopStateStore } from "../state/DesktopStateStore";
import { MENUBAR_DISPLAY_MODES, type DesktopMenubarDisplayMode, type DesktopMenubarDisplayState } from "../state/MenubarDisplayStore";

type DesktopIpcStateRoutesOptions = {
  getMenubarDisplay(): DesktopMenubarDisplayState;
  getNotificationsMuted(): boolean;
  getProfileFeatureEnabled(): boolean;
  inputs: DesktopIpcInputValidator;
  notifyNotificationHistoryChanged(): void;
  refreshAll(): void;
  refreshDesktopState(options: { invalidate: boolean; notifyRenderer: boolean }): Promise<void>;
  setMenubarDisplayMode(mode: DesktopMenubarDisplayMode): DesktopMenubarDisplayState;
  setNotificationsMuted(muted: boolean): boolean;
  setProfileFeatureEnabled(enabled: boolean): boolean;
  stateStore: DesktopStateStore;
  toggleMenubarTickerAgent(agentId: AgentId): DesktopMenubarDisplayState;
  updateAgentHome(agentId: AgentId, path: string | null): void;
};

export class DesktopIpcStateRoutes {
  constructor(private readonly options: DesktopIpcStateRoutesOptions) {}

  register(): void {
    const { inputs, stateStore } = this.options;

    ipcMain.handle("desktop:get-menubar-state", () => stateStore.getMenubarState());
    ipcMain.handle("desktop:get-menubar-display", () => this.options.getMenubarDisplay());
    ipcMain.handle("desktop:get-settings-state", () => stateStore.getSettingsState());
    ipcMain.handle("desktop:get-settings-state-snapshot", () => stateStore.getSettingsState({ refreshUsage: false }));
    ipcMain.handle("desktop:get-history-state", () => stateStore.getHistoryState());
    ipcMain.handle("desktop:get-notification-history", (_event, filter: unknown) =>
      stateStore.getNotificationHistory(inputs.readNotificationHistoryFilter(filter)));
    ipcMain.handle("desktop:get-notification-history-connections", (_event, filter: unknown) =>
      stateStore.getNotificationHistoryConnections(inputs.readNotificationHistoryFilter(filter)));
    ipcMain.handle("desktop:has-unread-notifications", () => stateStore.hasUnreadNotifications());
    ipcMain.handle("desktop:mark-notification-history-read", (_event, entryIds: unknown) => {
      stateStore.markNotificationHistoryRead(inputs.readStringArray(entryIds, "entryIds"));
      this.options.notifyNotificationHistoryChanged();
    });
    ipcMain.handle("desktop:mark-notification-history-read-by-filter", (_event, filter: unknown) => {
      stateStore.markNotificationHistoryReadByFilter(inputs.readNotificationHistoryFilter(filter));
      this.options.notifyNotificationHistoryChanged();
    });
    ipcMain.handle("desktop:get-notifications-muted", () => this.options.getNotificationsMuted());
    ipcMain.handle("desktop:get-profile-feature-enabled", () => this.options.getProfileFeatureEnabled());
    ipcMain.handle("desktop:set-menubar-display-mode", (_event, mode: unknown) => {
      return this.options.setMenubarDisplayMode(this.readMenubarDisplayMode(mode));
    });
    ipcMain.handle("desktop:set-notifications-muted", (_event, muted: unknown) => {
      return this.options.setNotificationsMuted(inputs.readBoolean(muted, "muted"));
    });
    ipcMain.handle("desktop:toggle-menubar-ticker-agent", (_event, agentId: unknown) => {
      return this.options.toggleMenubarTickerAgent(inputs.readAgentId(agentId));
    });
    ipcMain.handle("desktop:set-profile-feature-enabled", (_event, enabled: unknown) => {
      return this.options.setProfileFeatureEnabled(inputs.readBoolean(enabled, "enabled"));
    });
    ipcMain.handle("desktop:switch-connection", async (_event, agentId: unknown, connectionId: unknown) => {
      const result = await stateStore.switchConnection(
        inputs.readAgentId(agentId),
        inputs.readRequiredString(connectionId, "connectionId"),
      );
      this.options.refreshAll();
      return result;
    });
    ipcMain.handle("desktop:rollback-latest-mutation", async (_event, agentId: unknown) => {
      const result = await stateStore.rollbackLatestMutation(inputs.readAgentId(agentId));
      this.options.refreshAll();
      return result;
    });
    ipcMain.handle("desktop:import-detected-setups", (_event, scanIds: unknown) => {
      return stateStore.importDetectedSetups(inputs.readAgentIds(scanIds, "scanIds")).then((result) => {
        this.options.refreshAll();
        return result;
      });
    });
    ipcMain.handle("desktop:reset-state", () => {
      const result = stateStore.resetState();
      this.options.refreshAll();
      return result;
    });
    ipcMain.handle("desktop:refresh-settings", async () => {
      await this.options.refreshDesktopState({ invalidate: true, notifyRenderer: false });
    });
    ipcMain.handle("desktop:refresh-menubar", () => {
      this.options.refreshAll();
    });
    ipcMain.handle("desktop:update-agent-home", async (_event, agentId: unknown, path: unknown) => {
      this.options.updateAgentHome(
        inputs.readAgentId(agentId),
        inputs.readNullableString(path, "path"),
      );
      this.options.refreshAll();
    });
  }

  private readMenubarDisplayMode(value: unknown): DesktopMenubarDisplayMode {
    const mode = this.options.inputs.readRequiredString(value, "mode");
    if (MENUBAR_DISPLAY_MODES.includes(mode as DesktopMenubarDisplayMode)) {
      return mode as DesktopMenubarDisplayMode;
    }
    throw new Error(`Unsupported menubar display mode: ${mode}`);
  }
}
