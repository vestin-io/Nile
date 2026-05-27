import { app, Menu, nativeImage, shell, Tray, type MenuItemConstructorOptions } from "electron";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { DesktopNotificationTarget } from "../notifications/contracts";
import { readDesktopPlatformCapabilities } from "./PlatformCapabilities";
import { DesktopSettingsWindow } from "./SettingsWindow";
import { DesktopTrayPopupWindow } from "./TrayPopupWindow";

type DesktopShellOptions = {
  currentDir: string;
  onSettingsClose(): void;
  onTrayMenuRequested(): Promise<MenuItemConstructorOptions[]>;
  shouldHideOnClose(): boolean;
};

export class DesktopShell {
  private static readonly trayIconName = "nileTemplate@2x.png";
  private tray: Tray | null = null;
  private readonly settingsWindow: DesktopSettingsWindow;
  private readonly trayPopupWindow: DesktopTrayPopupWindow | null;

  constructor(private readonly options: DesktopShellOptions) {
    this.settingsWindow = new DesktopSettingsWindow({
      currentDir: options.currentDir,
      onSettingsClose: options.onSettingsClose,
      shouldHideOnClose: options.shouldHideOnClose,
    });
    this.trayPopupWindow = readDesktopPlatformCapabilities(process.platform).supportsTrayPopup
      ? new DesktopTrayPopupWindow({
          currentDir: options.currentDir,
          shouldHideOnClose: options.shouldHideOnClose,
        })
      : null;
  }

  async attach(): Promise<void> {
    const iconPath = this.readRuntimeAppIconPath();
    this.settingsWindow.attach(iconPath);
    this.trayPopupWindow?.attach(iconPath);
    this.createTray();
    this.setAppIcon();
  }

  notifyStateChanged(): void {
    this.sendToRendererWindows("desktop:state-changed");
  }

  notifyLocalStateReset(): void {
    this.sendToRendererWindows("desktop:local-state-reset");
  }

  notifyNotificationHistoryChanged(): void {
    this.sendToRendererWindows("desktop:notification-history-changed");
  }

  notifyPreferencesChanged(): void {
    this.sendToRendererWindows("desktop:preferences-changed");
  }

  setTrayTitle(title: string): void {
    if (!this.tray || process.platform !== "darwin") {
      return;
    }
    const normalizedTitle = title.trim();
    this.tray.setTitle(normalizedTitle);
    this.tray.setImage(normalizedTitle ? nativeImage.createEmpty() : this.createTrayImage());
  }

  setTrayToolTip(text: string): void {
    if (!this.tray) {
      return;
    }

    const normalizedText = text.trim() || "Nile";
    this.tray.setToolTip(normalizedText);
  }

  showSettings(): void {
    this.hideTrayPopup();
    this.settingsWindow.show();
  }

  prepareForUpdateInstall(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }

    this.settingsWindow.prepareForUpdateInstall();
    this.trayPopupWindow?.prepareForUpdateInstall();
  }

  showSettingsTarget(target: DesktopNotificationTarget): void {
    this.hideTrayPopup();
    this.settingsWindow.showTarget(target);
  }

  async chooseOpenAiAuthJsonPath(defaultPath?: string): Promise<string | null> {
    return await this.settingsWindow.chooseOpenAiAuthJsonPath(defaultPath);
  }

  async chooseCredentialExportPath(defaultFileName?: string): Promise<string | null> {
    return await this.settingsWindow.chooseCredentialExportPath(defaultFileName);
  }

  async chooseCredentialImportPath(defaultPath?: string): Promise<string | null> {
    return await this.settingsWindow.chooseCredentialImportPath(defaultPath);
  }

  async openExternalUrl(url: string): Promise<void> {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      throw new Error(`Unsupported external URL protocol: ${parsed.protocol}`);
    }
    await shell.openExternal(parsed.toString());
  }

  async openGitHubIssues(): Promise<void> {
    await shell.openExternal("https://github.com/vestin-io/Nile/issues");
  }

  async openSupportEmail(): Promise<void> {
    await shell.openExternal("mailto:info@vestin.io");
  }

  readDesktopPackageVersion(): string {
    const packageJsonPath = join(this.options.currentDir, "..", "..", "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: unknown };
    return typeof packageJson.version === "string" && packageJson.version.trim()
      ? packageJson.version.trim()
      : "0.0.0";
  }

  readRuntimeAppIconPath(): string {
    return join(this.options.currentDir, "..", "..", "build", "icons", "icon.png");
  }

  private createTray(): void {
    const icon = this.createTrayImage();
    this.tray = new Tray(icon);
    this.tray.setToolTip("Nile");
    const platformCapabilities = readDesktopPlatformCapabilities(process.platform);
    if (platformCapabilities.supportsTrayPopup) {
      const togglePopup = () => {
        void this.toggleTrayPopup();
      };
      this.tray.on("click", togglePopup);
      this.tray.on("right-click", () => {
        this.hideTrayPopup();
        void this.popTrayMenu();
      });
      return;
    }
    this.tray.on("click", () => {
      void this.popTrayMenu();
    });
    this.tray.on("right-click", () => {
      this.hideTrayPopup();
      void this.popTrayMenu();
    });
  }

  private async popTrayMenu(): Promise<void> {
    if (!this.tray) {
      return;
    }
    const menu = Menu.buildFromTemplate(await this.options.onTrayMenuRequested());
    this.tray.popUpContextMenu(menu);
  }

  private async toggleTrayPopup(): Promise<void> {
    if (!this.trayPopupWindow || !this.tray) {
      return;
    }
    await this.trayPopupWindow.toggle(this.tray);
  }

  private sendToRendererWindows(channel: string, payload?: unknown): void {
    this.settingsWindow.send(channel, payload);
    this.trayPopupWindow?.send(channel, payload);
  }

  private hideTrayPopup(): void {
    this.trayPopupWindow?.hide();
  }

  private createTrayImage() {
    const image = nativeImage.createFromPath(this.resolveTrayIconPath());
    if (!image.isEmpty()) {
      const sized = image.resize({ width: 20, height: 20 });
      sized.setTemplateImage(true);
      return sized;
    }
    return nativeImage.createEmpty();
  }

  private setAppIcon(): void {
    const image = nativeImage.createFromPath(this.readRuntimeAppIconPath());
    if (image.isEmpty()) {
      return;
    }
    if (process.platform === "darwin") {
      app.dock?.setIcon(image);
    }
  }

  private resolveTrayIconPath(): string {
    return join(this.options.currentDir, "..", "..", "build", "icons", DesktopShell.trayIconName);
  }
}
