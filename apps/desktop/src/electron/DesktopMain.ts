import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, Tray, type MenuItemConstructorOptions, type OpenDialogOptions } from "electron";
import { watch, type FSWatcher } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { AgentHomes } from "@nile/core/models/agent";
import { mergeAgentHomes, type AgentId } from "@nile/core/models/agent";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import {
  type CredentialStore,
  KeychainCredentialStore,
} from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import { ShellEnvironment } from "@nile/host-local";

import { DesktopSurface } from "../DesktopSurface";
import type { MenubarAgentState } from "../DesktopTypes";
import { DesktopConnectionManager } from "./DesktopConnectionManager";
import { DesktopStateStore } from "./DesktopStateStore";
import { AgentHomesStore } from "./AgentHomesStore";
import type { DesktopAddConnectionInput } from "./types";

const currentDir =
  typeof __dirname === "string"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

type DesktopMainOptions = {
  databasePath: string;
  agentHomes?: AgentHomes;
  credentialStore?: CredentialStore;
};

export class DesktopMain {
  private static readonly trayIconName = "nileTemplate@2x.png";
  private static readonly appIconName = "icon.png";
  private readonly logger: NileLogger;
  private readonly credentialStore: CredentialStore;
  private readonly environment: EnvironmentSource;
  private readonly agentHomesStore: AgentHomesStore;
  private readonly agentHomes: AgentHomes;
  private readonly surface: DesktopSurface;
  private readonly connectionManager: DesktopConnectionManager;
  private readonly stateStore: DesktopStateStore;
  private tray: Tray | null = null;
  private settingsWindow: BrowserWindow | null = null;
  private isQuitting = false;
  private workspaceWatcher: FSWatcher | null = null;
  private workspaceRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private ignoreWorkspaceChangesUntil = 0;

  constructor(private readonly options: DesktopMainOptions) {
    this.logger = NileLogger.createDefault({ module: "desktop-main" });
    this.credentialStore = options.credentialStore ?? new KeychainCredentialStore();
    this.environment = EnvironmentSource.from(new ShellEnvironment().readLoginShellEnvironment());
    this.agentHomesStore = new AgentHomesStore(
      join(dirname(options.databasePath), "desktop-agent-homes.json"),
    );
    this.agentHomes = mergeAgentHomes(options.agentHomes, this.agentHomesStore.read());
    this.surface = new DesktopSurface({
      databasePath: options.databasePath,
      agentHomes: this.agentHomes,
      environment: this.environment,
      credentialStore: this.credentialStore,
      logger: this.logger.child({ scope: "desktop-surface" }),
    });
    this.connectionManager = new DesktopConnectionManager({
      databasePath: options.databasePath,
      agentHomes: this.agentHomes,
      environment: this.environment,
      credentialStore: this.credentialStore,
    });
    this.stateStore = new DesktopStateStore({
      databasePath: options.databasePath,
      surface: this.surface,
      connectionManager: this.connectionManager,
    });
  }

  async start(): Promise<void> {
    app.setName("Nile");
    await app.whenReady();
    this.installApplicationMenu();
    this.setAppIcon();
    this.registerIpc();
    this.createSettingsWindow();
    this.createTray();
    this.startWorkspaceWatcher();
    void this.stateStore.refreshMenubarState().catch((error) => {
      this.logger.error("desktop.startup.refresh_menubar_failed", error);
    });
    void this.refreshMenubarUsage().catch((error) => {
      this.logger.error("desktop.startup.refresh_usage_failed", error);
    });
    void this.autoBindCursorUsageInBackground();

    app.on("before-quit", () => {
      this.isQuitting = true;
      this.stopWorkspaceWatcher();
    });

    app.on("activate", () => {
      this.openSettings();
    });
  }

  private registerIpc(): void {
    ipcMain.handle("desktop:get-menubar-state", () => this.stateStore.getMenubarState());
    ipcMain.handle("desktop:get-settings-state", () => this.stateStore.getSettingsState());
    ipcMain.handle("desktop:get-history-state", () => this.stateStore.getHistoryState());
    ipcMain.handle("desktop:list-connection-definitions", () => this.stateStore.listConnectionDefinitions());
    ipcMain.handle("desktop:choose-openai-auth-json-path", async (_event, defaultPath?: string) => {
      return await this.chooseOpenAiAuthJsonPath(defaultPath);
    });
    ipcMain.handle("desktop:describe-connection-onboarding", (_event, input: DesktopAddConnectionInput) =>
      this.stateStore.describeConnectionOnboarding(input),
    );
    ipcMain.handle("desktop:describe-saved-connection-onboarding", (_event, input) =>
      this.stateStore.describeSavedConnectionOnboarding(input),
    );
    ipcMain.handle("desktop:prepare-connection-draft", (_event, input: DesktopAddConnectionInput) =>
      this.stateStore.prepareConnectionDraft(input),
    );
    ipcMain.handle("desktop:save-prepared-connection", async (_event, input) => {
      const result = await this.stateStore.savePreparedConnection(input);
      this.reloadAll();
      return result;
    });
    ipcMain.handle("desktop:switch-connection", async (_event, agentId: MenubarAgentState["agentId"], connectionId: string) => {
      const result = await this.stateStore.switchConnection(agentId, connectionId);
      this.reloadAll();
      return result;
    });
    ipcMain.handle("desktop:rollback-latest-mutation", async (_event, agentId: MenubarAgentState["agentId"]) => {
      const result = await this.stateStore.rollbackLatestMutation(agentId);
      this.reloadAll();
      return result;
    });
    ipcMain.handle("desktop:add-connection", async (_event, input: DesktopAddConnectionInput) => {
      const result = await this.stateStore.addConnection(input);
      this.reloadAll();
      return result;
    });
    ipcMain.handle("desktop:update-connection", async (_event, input) => {
      const result = await this.stateStore.updateConnection(input);
      this.reloadAll();
      return result;
    });
    ipcMain.handle("desktop:import-detected-setups", (_event, scanIds: MenubarAgentState["agentId"][]) => {
      return this.stateStore.importDetectedSetups(scanIds).then((result) => {
        this.reloadAll();
        return result;
      });
    });
    ipcMain.handle("desktop:import-current-connection", (_event, agentId: MenubarAgentState["agentId"]) => {
      const result = this.stateStore.importCurrentConnection(agentId);
      this.reloadAll();
      return result;
    });
    ipcMain.handle("desktop:remove-connection", (_event, connectionId: string) => {
      const result = this.stateStore.removeConnection(connectionId);
      this.reloadAll();
      return result;
    });
    ipcMain.handle("desktop:bind-cursor-usage", (_event, connectionId: string, sessionToken: string) => {
      const result = this.stateStore.bindCursorUsage(connectionId, sessionToken);
      this.reloadAll();
      return result;
    });
    ipcMain.handle("desktop:reset-state", () => {
      const result = this.stateStore.resetState();
      this.reloadAll();
      return result;
    });
    ipcMain.handle("desktop:open-github-issues", async () => {
      await shell.openExternal("https://github.com/vestin-io/Nile/issues");
    });
    ipcMain.handle("desktop:open-external-url", async (_event, url: string) => {
      await this.openExternalUrl(url);
    });
    ipcMain.handle("desktop:open-settings", () => {
      this.openSettings();
    });
    ipcMain.handle("desktop:open-support-email", async () => {
      await shell.openExternal("mailto:info@vestin.io");
    });
    ipcMain.handle("desktop:refresh-settings", async () => {
      await this.refreshDesktopState({
        invalidate: true,
        notifyRenderer: false,
      });
    });
    ipcMain.handle("desktop:refresh-menubar", () => {
      this.reloadAll();
    });
    ipcMain.handle("desktop:update-agent-home", async (_event, agentId: AgentId, path: string | null) => {
      this.updateAgentHome(agentId, path);
      this.reloadAll();
    });
  }

  private installApplicationMenu(): void {
    if (process.platform !== "darwin") {
      return;
    }

    const menu = Menu.buildFromTemplate([
      {
        label: "Nile",
        submenu: [
          { role: "about", label: "About Nile" },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide", label: "Hide Nile" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit", label: "Quit Nile" },
        ],
      },
      {
        label: "File",
        submenu: [{ label: "Open Main Window", click: () => this.openSettings() }],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "View",
        submenu: [{ role: "reload" }, { role: "forceReload" }, { role: "toggleDevTools" }],
      },
      {
        role: "window",
        submenu: [{ role: "minimize" }, { role: "close" }],
      },
    ]);

    Menu.setApplicationMenu(menu);
  }

  private async openExternalUrl(url: string): Promise<void> {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error(`Unsupported external URL protocol: ${parsed.protocol}`);
    }

    await shell.openExternal(parsed.toString());
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
      icon: this.resolveAppIconPath(),
      trafficLightPosition: { x: 18, y: 18 },
      webPreferences: {
        preload: join(currentDir, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    const settingsUrl = pathToFileURL(join(currentDir, "..", "renderer", "settings.html"));
    this.settingsWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    this.settingsWindow.webContents.on("will-navigate", (event, url) => {
      const target = new URL(url);
      if (target.protocol !== settingsUrl.protocol || target.pathname !== settingsUrl.pathname) {
        event.preventDefault();
      }
    });
    this.settingsWindow.on("close", (event) => {
      if (this.isQuitting) {
        return;
      }

      event.preventDefault();
      this.settingsWindow?.hide();
    });
    void this.settingsWindow.loadFile(fileURLToPath(settingsUrl));
  }

  private async chooseOpenAiAuthJsonPath(defaultPath?: string): Promise<string | null> {
    const options: OpenDialogOptions = {
      title: "Choose auth.json",
      buttonLabel: "Use this file",
      defaultPath,
      filters: [
        { name: "JSON files", extensions: ["json"] },
      ],
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

  private async popTrayMenu(): Promise<void> {
    if (!this.tray) {
      return;
    }

    const state = await this.stateStore.refreshMenubarState().catch((error) => {
      this.logger.warn("desktop.menubar_state_refresh_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.stateStore.peekMenubarState();
    });
    const menu = Menu.buildFromTemplate(this.buildTrayTemplate(state));
    this.tray.popUpContextMenu(menu);
  }

  private openSettings(): void {
    this.settingsWindow?.show();
    this.settingsWindow?.focus();
    this.settingsWindow?.webContents.send("desktop:state-changed");
  }

  private reloadAll(): void {
    void this.refreshDesktopState({
      invalidate: false,
      notifyRenderer: true,
    });
  }

  private updateAgentHome(agentId: AgentId, path: string | null): void {
    const next = mergeAgentHomes(this.options.agentHomes, this.agentHomesStore.update(agentId, path));
    for (const key of Object.keys(this.agentHomes) as AgentId[]) {
      delete this.agentHomes[key];
    }
    Object.assign(this.agentHomes, next);
  }

  private startWorkspaceWatcher(): void {
    const workspaceDir = dirname(this.options.databasePath);
    try {
      this.workspaceWatcher = watch(workspaceDir, (_eventType, filename) => {
        if (!this.isRelevantWorkspaceChange(filename)) {
          return;
        }
        this.scheduleWorkspaceRefresh();
      });
      this.workspaceWatcher.on("error", (error) => {
        this.logger.warn("desktop.workspace_watch_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    } catch (error) {
      this.logger.warn("desktop.workspace_watch_start_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private stopWorkspaceWatcher(): void {
    this.workspaceWatcher?.close();
    this.workspaceWatcher = null;
    if (this.workspaceRefreshTimer) {
      clearTimeout(this.workspaceRefreshTimer);
      this.workspaceRefreshTimer = null;
    }
  }

  private isRelevantWorkspaceChange(filename: string | Buffer | null): boolean {
    if (!filename) {
      return true;
    }

    const workspaceFile = filename.toString();
    const databaseFile = basename(this.options.databasePath);
    return workspaceFile === databaseFile
      || workspaceFile === `${databaseFile}-wal`
      || workspaceFile === `${databaseFile}-shm`;
  }

  private scheduleWorkspaceRefresh(): void {
    if (this.isQuitting || Date.now() < this.ignoreWorkspaceChangesUntil) {
      return;
    }

    if (this.workspaceRefreshTimer) {
      clearTimeout(this.workspaceRefreshTimer);
    }

    this.workspaceRefreshTimer = setTimeout(() => {
      this.workspaceRefreshTimer = null;
      void this.refreshDesktopState({
        invalidate: true,
        notifyRenderer: true,
      }).catch((error) => {
        this.logger.warn("desktop.workspace_refresh_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, 250);
  }

  private async refreshDesktopState(options: {
    invalidate: boolean;
    notifyRenderer: boolean;
  }): Promise<void> {
    this.ignoreWorkspaceChangesUntil = Date.now() + 1000;
    if (options.invalidate) {
      this.stateStore.invalidateAll();
    }

    await Promise.allSettled([
      this.stateStore.refreshMenubarState(),
      this.refreshMenubarUsage(),
    ]);

    if (options.notifyRenderer) {
      this.settingsWindow?.webContents.send("desktop:state-changed");
    }
  }

  private async autoBindCursorUsageInBackground(): Promise<void> {
    try {
      const results = this.stateStore.autoBindAllCursorUsage();
      if (results.some((result) => result.status === "bound")) {
        this.reloadAll();
      }
    } catch (error) {
      this.logger.warn("desktop.cursor_usage.auto_bind_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private buildTrayTemplate(state: Awaited<ReturnType<DesktopStateStore["peekMenubarState"]>>): MenuItemConstructorOptions[] {
    if (!state) {
      return [
        { label: "Open Main Window", click: () => this.openSettings() },
        { type: "separator" },
        { label: "Loading connections…", enabled: false },
        { type: "separator" },
        { label: "Quit", click: () => app.quit() },
      ];
    }

    const template: MenuItemConstructorOptions[] = [
      { label: "Open Main Window", click: () => this.openSettings() },
      { type: "separator" },
      ...state.agents.map((agent) => this.buildAgentSubmenu(agent)),
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ];
    return template;
  }

  private buildAgentSubmenu(agent: MenubarAgentState): MenuItemConstructorOptions {
    if (agent.connections.length === 0) {
      return {
        label: agent.agentLabel,
        submenu: [{ label: "No saved connections", enabled: false }],
      };
    }

    const submenu: MenuItemConstructorOptions[] = [];
    if (agent.currentUsage?.status === "available") {
      submenu.push({ label: `Quota · ${agent.currentUsage.text}`, enabled: false });
      submenu.push({ type: "separator" });
    }

    submenu.push(...agent.connections.map<MenuItemConstructorOptions>((connection) => ({
      label: connection.label,
      type: "checkbox",
      checked: connection.isCurrent,
      click: () => {
        if (connection.isCurrent) {
          return;
        }
        void this.switchConnectionFromTray(agent.agentId, connection.id);
      },
    })));

    return {
      label: agent.agentLabel,
      submenu,
    };
  }

  private async switchConnectionFromTray(agentId: AgentId, connectionId: string): Promise<void> {
    try {
      await this.stateStore.switchConnection(agentId, connectionId);
      this.reloadAll();
    } catch (error) {
      this.logger.warn("desktop.tray.switch_failed", {
        agentId,
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
    const iconPath = this.resolveAppIconPath();
    const image = nativeImage.createFromPath(iconPath);
    if (image.isEmpty()) {
      return;
    }

    if (process.platform === "darwin") {
      app.dock?.setIcon(image);
    }
  }

  private resolveTrayIconPath(): string {
    return join(currentDir, "..", "..", "build", "icons", DesktopMain.trayIconName);
  }

  private resolveAppIconPath(): string {
    return join(currentDir, "..", "..", "build", "icons", DesktopMain.appIconName);
  }

  private refreshMenubarUsage(): Promise<void> {
    return this.stateStore.refreshMenubarUsage()
      .then(() => {
        this.settingsWindow?.webContents.send("desktop:state-changed");
      })
      .catch((error) => {
        this.logger.warn("desktop.menubar_usage_refresh_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }
}
