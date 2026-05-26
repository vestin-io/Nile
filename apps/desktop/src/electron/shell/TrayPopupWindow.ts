import { BrowserWindow, Tray, screen } from "electron";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { TrayPopupPlacement } from "./TrayPopupPlacement";

type DesktopTrayPopupWindowOptions = {
  currentDir: string;
  shouldHideOnClose(): boolean;
};

export class DesktopTrayPopupWindow {
  private static readonly popupWidth = 440;
  private static readonly popupHeight = 620;
  private static readonly windowLoadTimeoutMs = 2_000;
  private window: BrowserWindow | null = null;

  constructor(private readonly options: DesktopTrayPopupWindowOptions) {}

  attach(iconPath: string): void {
    this.window = new BrowserWindow({
      width: DesktopTrayPopupWindow.popupWidth,
      height: DesktopTrayPopupWindow.popupHeight,
      show: false,
      frame: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      backgroundColor: "#10151d",
      icon: iconPath,
      webPreferences: {
        preload: join(this.options.currentDir, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    const popupUrl = pathToFileURL(join(this.options.currentDir, "..", "renderer", "menubar.html"));
    this.window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    this.window.on("blur", () => {
      this.window?.hide();
    });
    this.window.on("close", (event) => {
      if (this.options.shouldHideOnClose()) {
        event.preventDefault();
        this.window?.hide();
      }
    });
    this.window.on("closed", () => {
      this.window = null;
    });
    void this.window.loadFile(fileURLToPath(popupUrl));
  }

  async toggle(tray: Tray): Promise<void> {
    const window = this.readWindowForSend();
    if (!window) {
      return;
    }
    if (window.isVisible()) {
      window.hide();
      return;
    }
    await this.waitForLoad(window);
    const trayBounds = tray.getBounds();
    const workArea = screen.getDisplayMatching(trayBounds).workArea;
    const position = TrayPopupPlacement.readPosition({
      popupHeight: DesktopTrayPopupWindow.popupHeight,
      popupWidth: DesktopTrayPopupWindow.popupWidth,
      trayBounds,
      workArea,
    });
    window.setPosition(position.x, position.y, false);
    window.show();
    window.focus();
  }

  hide(): void {
    const window = this.readWindowForSend();
    if (!window || !window.isVisible()) {
      return;
    }
    window.hide();
  }

  prepareForUpdateInstall(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
      this.window = null;
    }
  }

  send(channel: string, payload?: unknown): void {
    const window = this.readWindowForSend();
    if (!window) {
      return;
    }
    if (payload === undefined) {
      window.webContents.send(channel);
      return;
    }
    window.webContents.send(channel, payload);
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

  private async waitForLoad(window: BrowserWindow): Promise<void> {
    if (!window.webContents.isLoadingMainFrame()) {
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
        window.webContents.removeListener("did-finish-load", settle);
        window.webContents.removeListener("did-fail-load", settle);
        resolve();
      };
      const timeoutId = setTimeout(settle, DesktopTrayPopupWindow.windowLoadTimeoutMs);
      window.webContents.once("did-finish-load", settle);
      window.webContents.once("did-fail-load", settle);
    });
  }
}
