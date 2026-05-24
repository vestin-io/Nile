import { app, BrowserWindow, dialog, Menu, nativeImage, shell, Tray, type MenuItemConstructorOptions, type OpenDialogOptions } from "electron";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  parseLanguagePreferenceFromDesktopPreferences,
  type LanguagePreference,
} from "../../state/UiPreferences";
import {
  parseConnectionQuotaMetricPreferencesFromDesktopPreferences,
  type ConnectionQuotaMetricPreferences,
} from "../../state/ConnectionQuotaMetricPreferences";
import type { DesktopNotificationTarget } from "../notifications/contracts";

type DesktopShellOptions = {
  currentDir: string;
  onSettingsClose(): void;
  onTrayMenuRequested(): Promise<MenuItemConstructorOptions[]>;
  shouldHideOnClose(): boolean;
};

export class DesktopShell {
  private static readonly trayIconName = "nileTemplate@2x.png";
  private static readonly preferencesStorageKey = "nile.desktop.preferences";
  private static readonly settingsLoadTimeoutMs = 2_000;
  private tray: Tray | null = null;
  private settingsWindow: BrowserWindow | null = null;
  private pendingNotificationTarget: DesktopNotificationTarget | null = null;

  constructor(private readonly options: DesktopShellOptions) {}

  async attach(): Promise<LanguagePreference | null> {
    this.createSettingsWindow();
    const initialLanguagePreference = await this.readInitialLanguagePreference();
    this.createTray();
    this.setAppIcon();
    return initialLanguagePreference;
  }

  notifyStateChanged(): void {
    this.sendToSettingsWindow("desktop:state-changed");
  }

  notifyLocalStateReset(): void {
    this.sendToSettingsWindow("desktop:local-state-reset");
  }

  notifyNotificationHistoryChanged(): void {
    this.sendToSettingsWindow("desktop:notification-history-changed");
  }

  setTrayTitle(title: string): void {
    if (!this.tray || process.platform !== "darwin") {
      return;
    }
    const normalizedTitle = title.trim();
    this.tray.setTitle(normalizedTitle);
    this.tray.setImage(normalizedTitle ? nativeImage.createEmpty() : this.createTrayImage());
  }

  showSettings(): void {
    this.settingsWindow?.show();
    this.settingsWindow?.focus();
  }

  prepareForUpdateInstall(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }

    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.close();
    }
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

  async readConnectionQuotaMetricPreferences(): Promise<ConnectionQuotaMetricPreferences> {
    try {
      const raw = await this.readDesktopPreferencesRaw();
      return parseConnectionQuotaMetricPreferencesFromDesktopPreferences(raw);
    } catch {
      return {};
    }
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
    this.settingsWindow.on("closed", () => {
      this.settingsWindow = null;
    });
    void this.settingsWindow.loadFile(fileURLToPath(settingsUrl));
  }

  private async readInitialLanguagePreference(): Promise<LanguagePreference | null> {
    try {
      const raw = await this.readDesktopPreferencesRaw();
      return parseLanguagePreferenceFromDesktopPreferences(typeof raw === "string" ? raw : null);
    } catch {
      return null;
    }
  }

  private async waitForSettingsWindowLoad(settingsWindow: BrowserWindow): Promise<void> {
    if (!settingsWindow.webContents.isLoadingMainFrame()) {
      return;
    }
    await new Promise<void>((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
        settingsWindow.webContents.removeListener("did-finish-load", settle);
        settingsWindow.webContents.removeListener("did-fail-load", settle);
        resolve();
      };
      const timeoutId = setTimeout(settle, DesktopShell.settingsLoadTimeoutMs);
      settingsWindow.webContents.once("did-finish-load", settle);
      settingsWindow.webContents.once("did-fail-load", settle);
    });
  }

  private async readDesktopPreferencesRaw(): Promise<string | null> {
    const settingsWindow = this.readSettingsWindowForSend();
    if (!settingsWindow) {
      return null;
    }

    await this.waitForSettingsWindowLoad(settingsWindow);
    const raw = await settingsWindow.webContents.executeJavaScript(
      `window.localStorage.getItem(${JSON.stringify(DesktopShell.preferencesStorageKey)})`,
      true,
    );
    return typeof raw === "string" ? raw : null;
  }

  private async popTrayMenu(): Promise<void> {
    if (!this.tray) {
      return;
    }
    const menu = Menu.buildFromTemplate(await this.options.onTrayMenuRequested());
    this.tray.popUpContextMenu(menu);
  }

  private sendNotificationTarget(target: DesktopNotificationTarget): void {
    const settingsWindow = this.readSettingsWindowForSend();
    if (!settingsWindow) {
      return;
    }
    if (settingsWindow.webContents.isLoadingMainFrame()) {
      this.pendingNotificationTarget = target;
      return;
    }
    this.sendToSettingsWindow("desktop:notification-target", target);
  }

  private sendToSettingsWindow(channel: string, payload?: unknown): void {
    const settingsWindow = this.readSettingsWindowForSend();
    if (!settingsWindow) {
      return;
    }
    if (payload === undefined) {
      settingsWindow.webContents.send(channel);
      return;
    }
    settingsWindow.webContents.send(channel, payload);
  }

  private readSettingsWindowForSend(): BrowserWindow | null {
    if (!this.settingsWindow) {
      return null;
    }
    if (this.settingsWindow.isDestroyed() || this.settingsWindow.webContents.isDestroyed()) {
      return null;
    }
    return this.settingsWindow;
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
