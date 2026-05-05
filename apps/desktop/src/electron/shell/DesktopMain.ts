import { app, type MenuItemConstructorOptions } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { AgentHomes } from "@nile/core/models/agent";
import { mergeAgentHomes, type AgentId } from "@nile/core/models/agent";
import { StateReset } from "@nile/core/application/local";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import {
  type CredentialStore,
  KeychainCredentialStore,
} from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import { ShellEnvironment } from "@nile/host-local";

import { DesktopSurface } from "../../state/Surface";
import type { MenubarAgentState } from "../../state/Types";
import { DesktopApplicationMenu } from "./DesktopApplicationMenu";
import { AgentHomesStore } from "../state/AgentHomesStore";
import { AutoUpdateManager } from "../updates/AutoUpdateManager";
import { DesktopConnectionGateway } from "../connections/DesktopConnectionGateway";
import { DesktopConnectionManager } from "../connections/DesktopConnectionManager";
import { DesktopIpcAppRoutes } from "../ipc/DesktopIpcAppRoutes";
import { DesktopIpcConnectionRoutes } from "../ipc/DesktopIpcConnectionRoutes";
import { DesktopIpcInputValidator } from "../ipc/DesktopIpcInputValidator";
import { DesktopIpcStateRoutes } from "../ipc/DesktopIpcStateRoutes";
import { DesktopIpcUpdateRoutes } from "../ipc/DesktopIpcUpdateRoutes";
import { DesktopShell } from "./DesktopShell";
import { DesktopStateRefresher } from "../state/DesktopStateRefresher";
import { DesktopStateStore } from "../state/DesktopStateStore";
import { DesktopWorkspaceWatcher } from "./DesktopWorkspaceWatcher";

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
  private readonly logger: NileLogger;
  private readonly credentialStore: CredentialStore;
  private readonly environment: EnvironmentSource;
  private readonly agentHomesStore: AgentHomesStore;
  private readonly agentHomes: AgentHomes;
  private readonly surface: DesktopSurface;
  private readonly connectionGateway: DesktopConnectionGateway;
  private readonly connectionManager: DesktopConnectionManager;
  private readonly stateStore: DesktopStateStore;
  private readonly stateRefresher: DesktopStateRefresher;
  private readonly workspaceWatcher: DesktopWorkspaceWatcher;
  private readonly shell: DesktopShell;
  private readonly autoUpdateManager: AutoUpdateManager;
  private readonly applicationMenu: DesktopApplicationMenu;
  private readonly inputs = new DesktopIpcInputValidator();
  private isQuitting = false;

  constructor(private readonly options: DesktopMainOptions) {
    this.logger = NileLogger.createDefault({ module: "desktop-main" });
    this.credentialStore = options.credentialStore ?? new KeychainCredentialStore();
    this.environment = EnvironmentSource.from(new ShellEnvironment().readLoginShellEnvironment());
    this.agentHomesStore = new AgentHomesStore(join(dirname(options.databasePath), "desktop-agent-homes.json"));
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
    this.connectionGateway = new DesktopConnectionGateway({
      databasePath: options.databasePath,
      agentHomes: this.agentHomes,
      environment: this.environment,
      credentialStore: this.credentialStore,
    });
    this.stateStore = new DesktopStateStore({
      databasePath: options.databasePath,
      surface: this.surface,
      connectionGateway: this.connectionGateway,
      connectionManager: this.connectionManager,
      stateReset: new StateReset(this.credentialStore),
    });
    this.shell = new DesktopShell({
      currentDir,
      onSettingsClose: () => {
        this.connectionManager.clearPreparedConnectionDrafts();
      },
      onTrayMenuRequested: async () => await this.readTrayTemplate(),
      shouldHideOnClose: () => !this.isQuitting,
    });
    this.stateRefresher = new DesktopStateRefresher({
      logger: this.logger,
      notifyRenderer: () => this.shell.notifyStateChanged(),
      stateStore: this.stateStore,
    });
    this.workspaceWatcher = new DesktopWorkspaceWatcher({
      databasePath: options.databasePath,
      logger: this.logger,
      onRelevantChange: () => {
        if (this.isQuitting) {
          return;
        }
        void this.refreshDesktopState({
          invalidate: true,
          notifyRenderer: true,
        }).catch((error) => {
          this.logger.warn("desktop.workspace_refresh_failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      },
    });
    this.autoUpdateManager = new AutoUpdateManager({
      logger: this.logger.child({ scope: "auto-update" }),
      isPackaged: app.isPackaged,
      platform: process.platform,
      version: this.shell.readDesktopPackageVersion(),
      onReleaseInfoChanged: () => this.shell.notifyStateChanged(),
    });
    this.applicationMenu = new DesktopApplicationMenu({
      appIconPath: this.shell.readRuntimeAppIconPath(),
      openSettings: () => this.shell.showSettings(),
      platform: process.platform,
      version: this.shell.readDesktopPackageVersion(),
    });
  }

  async start(): Promise<void> {
    app.setName("Nile");
    await app.whenReady();
    this.autoUpdateManager.start();
    this.applicationMenu.configureAboutPanel();
    this.applicationMenu.install();
    this.registerIpcRoutes();
    this.shell.attach();
    this.workspaceWatcher.start();
    void this.stateStore.refreshMenubarState().catch((error) => {
      this.logger.error("desktop.startup.refresh_menubar_failed", error);
    });
    void this.refreshMenubarUsage().catch((error) => {
      this.logger.error("desktop.startup.refresh_usage_failed", error);
    });
    void this.autoBindCursorUsageInBackground();

    app.on("before-quit", () => {
      this.isQuitting = true;
      this.connectionManager.clearPreparedConnectionDrafts();
      this.workspaceWatcher.stop();
    });
    app.on("activate", () => {
      this.shell.showSettings();
    });
  }

  private registerIpcRoutes(): void {
    new DesktopIpcStateRoutes({
      inputs: this.inputs,
      refreshAll: () => this.reloadAll(),
      refreshDesktopState: (options) => this.refreshDesktopState(options),
      stateStore: this.stateStore,
      updateAgentHome: (agentId, path) => this.updateAgentHome(agentId, path),
    }).register();
    new DesktopIpcConnectionRoutes({
      chooseOpenAiAuthJsonPath: (defaultPath) => this.shell.chooseOpenAiAuthJsonPath(defaultPath),
      connectionManager: this.connectionManager,
      inputs: this.inputs,
      refreshAll: () => this.reloadAll(),
      stateStore: this.stateStore,
    }).register();
    new DesktopIpcUpdateRoutes({
      autoUpdateManager: this.autoUpdateManager,
    }).register();
    new DesktopIpcAppRoutes({
      inputs: this.inputs,
      openExternalUrl: (url) => this.shell.openExternalUrl(url),
      openGitHubIssues: async () => await this.shell.openGitHubIssues(),
      openSettings: () => this.shell.showSettings(),
      openSupportEmail: async () => await this.shell.openSupportEmail(),
    }).register();
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

  private async refreshDesktopState(options: {
    invalidate: boolean;
    notifyRenderer: boolean;
  }): Promise<void> {
    this.workspaceWatcher.ignoreChangesFor(1000);
    await this.stateRefresher.refreshDesktopState(options);
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

  private async readTrayTemplate(): Promise<MenuItemConstructorOptions[]> {
    const state = await this.stateStore.refreshMenubarState().catch((error) => {
      this.logger.warn("desktop.menubar_state_refresh_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.stateStore.peekMenubarState();
    });
    return this.buildTrayTemplate(state);
  }

  private buildTrayTemplate(state: Awaited<ReturnType<DesktopStateStore["peekMenubarState"]>>): MenuItemConstructorOptions[] {
    if (!state) {
      return [
        { label: "Open Main Window", click: () => this.shell.showSettings() },
        { type: "separator" },
        { label: "Loading connections…", enabled: false },
        { type: "separator" },
        { label: "Quit", click: () => app.quit() },
      ];
    }

    return [
      { label: "Open Main Window", click: () => this.shell.showSettings() },
      { type: "separator" },
      ...state.agents.map((agent) => this.buildAgentSubmenu(agent)),
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ];
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

  private refreshMenubarUsage(): Promise<void> {
    return this.stateRefresher.refreshMenubarUsage();
  }
}
