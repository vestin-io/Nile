import { BrowserWindow, dialog, type OpenDialogOptions } from "electron";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { DesktopNotificationTarget } from "../notifications/contracts";

type DesktopSettingsWindowOptions = {
  currentDir: string;
  onSettingsClose(): void;
  shouldHideOnClose(): boolean;
};

export class DesktopSettingsWindow {
  private static readonly windowLoadTimeoutMs = 2_000;
  private window: BrowserWindow | null = null;
  private pendingNotificationTarget: DesktopNotificationTarget | null = null;

  constructor(private readonly options: DesktopSettingsWindowOptions) {}

  attach(iconPath: string): void {
    this.window = new BrowserWindow({
      width: 980,
      height: 760,
      show: false,
      title: "Nile",
      backgroundColor: "#ffffff",
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : undefined,
      icon: iconPath,
      trafficLightPosition: { x: 18, y: 18 },
      webPreferences: {
        preload: join(this.options.currentDir, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    const settingsUrl = pathToFileURL(join(this.options.currentDir, "..", "renderer", "settings.html"));
    this.window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    this.window.webContents.on("did-finish-load", () => {
      if (!this.pendingNotificationTarget) {
        return;
      }
      const pendingTarget = this.pendingNotificationTarget;
      this.pendingNotificationTarget = null;
      this.window?.webContents.send("desktop:notification-target", pendingTarget);
    });
    this.window.webContents.on("will-navigate", (event, url) => {
      const target = new URL(url);
      if (target.protocol !== settingsUrl.protocol || target.pathname !== settingsUrl.pathname) {
        event.preventDefault();
      }
    });
    this.window.on("close", (event) => {
      if (!this.options.shouldHideOnClose()) {
        return;
      }
      event.preventDefault();
      this.options.onSettingsClose();
      this.window?.hide();
    });
    this.window.on("closed", () => {
      this.window = null;
    });
    void this.window.loadFile(fileURLToPath(settingsUrl));
  }

  show(): void {
    this.window?.show();
    this.window?.focus();
  }

  prepareForUpdateInstall(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }
  }

  showTarget(target: DesktopNotificationTarget): void {
    this.show();
    const settingsWindow = this.readWindowForSend();
    if (!settingsWindow) {
      return;
    }
    if (settingsWindow.webContents.isLoadingMainFrame()) {
      this.pendingNotificationTarget = target;
      return;
    }
    settingsWindow.webContents.send("desktop:notification-target", target);
  }

  send(channel: string, payload?: unknown): void {
    const settingsWindow = this.readWindowForSend();
    if (!settingsWindow) {
      return;
    }
    if (payload === undefined) {
      settingsWindow.webContents.send(channel);
      return;
    }
    settingsWindow.webContents.send(channel, payload);
  }

  async chooseOpenAiAuthJsonPath(defaultPath?: string): Promise<string | null> {
    const options: OpenDialogOptions = {
      title: "Choose auth.json",
      buttonLabel: "Use this file",
      defaultPath: this.resolveDialogPath(defaultPath),
      filters: [{ name: "JSON files", extensions: ["json"] }],
      properties: ["openFile"],
    };
    const result = this.window
      ? await dialog.showOpenDialog(this.window, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled) {
      return null;
    }
    return result.filePaths[0] ?? null;
  }

  private readWindowForSend(): BrowserWindow | null {
    if (!this.window) {
      return null;
    }
    if (this.window.isDestroyed() || this.window.webContents.isDestroyed()) {
      return null;
    }
    return this.window;
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
}
