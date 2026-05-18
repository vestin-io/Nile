import { ipcMain } from "electron";

import type { DesktopInstallUpdateResult } from "../../state/Types";
import { AutoUpdateManager } from "../updates/AutoUpdateManager";

type DesktopIpcUpdateRoutesOptions = {
  autoUpdateManager: AutoUpdateManager;
  installDesktopUpdate(): DesktopInstallUpdateResult;
};

export class DesktopIpcUpdateRoutes {
  constructor(private readonly options: DesktopIpcUpdateRoutesOptions) {}

  register(): void {
    const { autoUpdateManager } = this.options;

    ipcMain.handle("desktop:get-release-info", () => autoUpdateManager.getReleaseInfo());
    ipcMain.handle("desktop:check-for-updates", () => autoUpdateManager.checkForUpdates());
    ipcMain.handle("desktop:install-update", () => this.options.installDesktopUpdate());
  }
}
