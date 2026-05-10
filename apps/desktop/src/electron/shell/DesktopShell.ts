import { app, BrowserWindow, dialog, Menu, nativeImage, shell, Tray, type MenuItemConstructorOptions, type OpenDialogOptions } from "electron";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { DesktopNotificationTarget } from "../notifications/contracts";

type DesktopShellOptions = {
  currentDir: string;
  onSettingsClose(): void;
  onTrayMenuRequested(): Promise<MenuItemConstructorOptions[]>;
  shouldHideOnClose(): boolean;
};

export class DesktopShell {
  private static readonly trayIconName = "nileTemplate@2x.png";
  private tray: Tray | null = null;
  private settingsWindow: BrowserWindow | null = null;
  private pendingNotificationTarget: DesktopNotificationTarget | null = null;

  constructor(private readonly options: DesktopShellOptions) {}

  attach(): void {
    this.createSettingsWindow();
    this.createTray();
    this.setAppIcon();
  }

  notifyStateChanged(): void {
    this.settingsWindow?.webContents.send("desktop:state-changed");
  }

  notifyNotificationHistoryChanged(): void {
    this.settingsWindow?.webContents.send("desktop:notification-history-changed");
  }

  showSettings(): void {
    this.settingsWindow?.show();
    this.settingsWindow?.focus();
  }

  showSettingsTarget(target: DesktopNotificationTarget): void {
    this.showSettings();
    this.sendNotificationTarget(target);
  }

  async chooseOpenAiAuthJsonPath(defaultPath?: string): Promise<string | null> {
    const options: OpenDialogOptions = {
      title: "Choose auth.json",
      buttonLabel: "Use this file",
      defaultPath: this.resolveDialogPath(defaultPath),
      filters: [{ name: "JSON files", extensions: ["json"] }],
      properties: ["openFile"],
    };
    const result = this.settingsWindow
      ? await dialog.showOpenDialog(this.settingsWindow, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled) {
      return null;
    }
    return result.filePaths[0] ?? null;
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
    this.tray.on("click", () => {
      void this.popTrayMenu();
    });
    this.tray.on("right-click", () => {
      void this.popTrayMenu();
    });
  }

  private createSettingsWindow(): void {
    this.settingsWindow = new BrowserWindow({
      width: 980,
      height: 760,
      show: false,
      title: "Nile",
      backgroundColor: "#ffffff",
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : undefined,
      icon: this.readRuntimeAppIconPath(),
      trafficLightPosition: { x: 18, y: 18 },
      webPreferences: {
        preload: join(this.options.currentDir, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    const settingsUrl = pathToFileURL(join(this.options.currentDir, "..", "renderer", "settings.html"));
    this.settingsWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    this.settingsWindow.webContents.on("did-finish-load", () => {
      if (!this.pendingNotificationTarget) {
        return;
      }
      const pendingTarget = this.pendingNotificationTarget;
      this.pendingNotificationTarget = null;
      this.settingsWindow?.webContents.send("desktop:notification-target", pendingTarget);
    });
    this.settingsWindow.webContents.on("will-navigate", (event, url) => {
      const target = new URL(url);
      if (target.protocol !== settingsUrl.protocol || target.pathname !== settingsUrl.pathname) {
        event.preventDefault();
      }
    });
    this.settingsWindow.on("close", (event) => {
      if (!this.options.shouldHideOnClose()) {
        return;
      }
      event.preventDefault();
      this.options.onSettingsClose();
      this.settingsWindow?.hide();
    });
    void this.settingsWindow.loadFile(fileURLToPath(settingsUrl));
  }

  private async popTrayMenu(): Promise<void> {
    if (!this.tray) {
      return;
    }
    const menu = Menu.buildFromTemplate(await this.options.onTrayMenuRequested());
    this.tray.popUpContextMenu(menu);
  }

  private sendNotificationTarget(target: DesktopNotificationTarget): void {
    if (!this.settingsWindow) {
      return;
    }
    if (this.settingsWindow.webContents.isLoadingMainFrame()) {
      this.pendingNotificationTarget = target;
      return;
    }
    this.settingsWindow.webContents.send("desktop:notification-target", target);
  }

  private resolveDialogPath(path: string | undefined): string | undefined {
    const trimmed = path?.trim();
    if (!trimmed) {
      return undefined;
    }
    if (trimmed === "~") {
      return homedir();
    }
    if (trimmed.startsWith("~/")) {
      return resolve(homedir(), trimmed.slice(2));
    }
    return trimmed;
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
