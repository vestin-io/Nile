import { ipcMain } from "electron";

import { DesktopIpcInputValidator } from "./DesktopIpcInputValidator";

type DesktopIpcAppRoutesOptions = {
  inputs: DesktopIpcInputValidator;
  openExternalUrl(url: string): Promise<void>;
  openGitHubIssues(): Promise<void>;
  openSettings(): void;
  openSupportEmail(): Promise<void>;
};

export class DesktopIpcAppRoutes {
  constructor(private readonly options: DesktopIpcAppRoutesOptions) {}

  register(): void {
    ipcMain.handle("desktop:open-github-issues", () => this.options.openGitHubIssues());
    ipcMain.handle("desktop:open-external-url", async (_event, url: unknown) => {
      await this.options.openExternalUrl(this.options.inputs.readRequiredString(url, "url"));
    });
    ipcMain.handle("desktop:open-settings", () => {
      this.options.openSettings();
    });
    ipcMain.handle("desktop:open-support-email", () => this.options.openSupportEmail());
  }
}
