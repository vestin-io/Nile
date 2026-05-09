import { ipcMain } from "electron";

import type { AgentId } from "@nile/core/models/agent";

import { DesktopIpcInputValidator } from "./DesktopIpcInputValidator";
import { DesktopStateStore } from "../state/DesktopStateStore";

type DesktopIpcStateRoutesOptions = {
  getProfileFeatureEnabled(): boolean;
  inputs: DesktopIpcInputValidator;
  refreshAll(): void;
  refreshDesktopState(options: { invalidate: boolean; notifyRenderer: boolean }): Promise<void>;
  setProfileFeatureEnabled(enabled: boolean): boolean;
  stateStore: DesktopStateStore;
  updateAgentHome(agentId: AgentId, path: string | null): void;
};

export class DesktopIpcStateRoutes {
  constructor(private readonly options: DesktopIpcStateRoutesOptions) {}

  register(): void {
    const { inputs, stateStore } = this.options;

    ipcMain.handle("desktop:get-menubar-state", () => stateStore.getMenubarState());
    ipcMain.handle("desktop:get-settings-state", () => stateStore.getSettingsState());
    ipcMain.handle("desktop:get-settings-state-snapshot", () => stateStore.getSettingsState({ refreshUsage: false }));
    ipcMain.handle("desktop:get-history-state", () => stateStore.getHistoryState());
    ipcMain.handle("desktop:get-profile-feature-enabled", () => this.options.getProfileFeatureEnabled());
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
}
