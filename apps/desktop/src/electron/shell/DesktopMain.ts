import { app } from "electron";
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
import { DesktopApplicationMenu } from "./DesktopApplicationMenu";
import { AgentHomesStore } from "../state/AgentHomesStore";
import { AutoUpdateManager } from "../updates/AutoUpdateManager";
import { DesktopConnectionGateway } from "../connections/DesktopConnectionGateway";
import { DesktopConnectionManager } from "../connections/DesktopConnectionManager";
import { DesktopIpcAppRoutes } from "../ipc/DesktopIpcAppRoutes";
import { DesktopIpcConnectionRoutes } from "../ipc/DesktopIpcConnectionRoutes";
import { DesktopIpcInputValidator } from "../ipc/DesktopIpcInputValidator";
import { DesktopIpcProfileRoutes } from "../ipc/DesktopIpcProfileRoutes";
import { DesktopIpcStateRoutes } from "../ipc/DesktopIpcStateRoutes";
import { DesktopIpcUpdateRoutes } from "../ipc/DesktopIpcUpdateRoutes";
import { WorkspaceProfileManager } from "../profiles/Manager";
import { WorkspaceProfileStore } from "../profiles/Store";
import { DesktopShell } from "./DesktopShell";
import { DesktopTrayMenu } from "./TrayMenu";
import { DesktopStateReset } from "../state/Reset";
import { DesktopProfileFeatureStore } from "../state/ProfileFeatureStore";
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
  private readonly profileFeatureStore: DesktopProfileFeatureStore;
  private readonly profileStore: WorkspaceProfileStore;
  private readonly profileManager: WorkspaceProfileManager;
  private readonly agentHomes: AgentHomes;
  private readonly surface: DesktopSurface;
  private readonly connectionGateway: DesktopConnectionGateway;
  private readonly connectionManager: DesktopConnectionManager;
  private readonly stateStore: DesktopStateStore;
  private readonly stateRefresher: DesktopStateRefresher;
  private readonly workspaceWatcher: DesktopWorkspaceWatcher;
  private readonly shell: DesktopShell;
  private readonly trayMenu: DesktopTrayMenu;
  private readonly autoUpdateManager: AutoUpdateManager;
  private readonly applicationMenu: DesktopApplicationMenu;
  private readonly inputs = new DesktopIpcInputValidator();
  private isQuitting = false;

  constructor(private readonly options: DesktopMainOptions) {
    this.logger = NileLogger.createDefault({ module: "desktop-main" });
    this.credentialStore = options.credentialStore ?? new KeychainCredentialStore();
    this.environment = EnvironmentSource.from(new ShellEnvironment().readLoginShellEnvironment());
    this.agentHomesStore = new AgentHomesStore(join(dirname(options.databasePath), "desktop-agent-homes.json"));
    this.profileFeatureStore = new DesktopProfileFeatureStore(join(dirname(options.databasePath), "desktop-profile-feature.json"));
    this.profileStore = new WorkspaceProfileStore(join(dirname(options.databasePath), "desktop-profiles.json"));
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
      stateReset: new DesktopStateReset({
        localStatePaths: [
          join(dirname(options.databasePath), "desktop-agent-homes.json"),
          join(dirname(options.databasePath), "desktop-profiles.json"),
          join(dirname(options.databasePath), "desktop-profile-feature.json"),
        ],
        onResetLocalState: () => this.resetDesktopLocalState(),
        stateReset: new StateReset(this.credentialStore),
      }),
    });
    this.profileManager = new WorkspaceProfileManager({
      stateStore: this.stateStore,
      store: this.profileStore,
      updateAgentHome: (agentId, path) => this.updateAgentHome(agentId, path),
    });
    this.shell = new DesktopShell({
      currentDir,
      onSettingsClose: () => {
        this.connectionManager.clearPreparedConnectionDrafts();
      },
      onTrayMenuRequested: async () => await this.trayMenu.readTemplate(),
      shouldHideOnClose: () => !this.isQuitting,
    });
    this.trayMenu = new DesktopTrayMenu({
      logger: this.logger,
      peekState: () => this.stateStore.peekMenubarState(),
      peekSettingsState: () => this.stateStore.peekSettingsState(),
      isProfileFeatureEnabled: () => this.profileFeatureStore.read(),
      refreshState: async () => await this.stateStore.refreshMenubarState(),
      refreshSettingsState: async () => await this.stateStore.getSettingsState({ refreshUsage: false }),
      listProfiles: () => this.profileManager.list(),
      showSettings: () => this.shell.showSettings(),
      quitApp: () => app.quit(),
      applyProfile: async (profileId) => {
        await this.profileManager.apply(profileId);
        this.reloadAll();
      },
      switchConnection: async (agentId, connectionId) => {
        await this.stateStore.switchConnection(agentId, connectionId);
        this.reloadAll();
      },
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
      isPackaged: app.isPackaged,
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
      getProfileFeatureEnabled: () => this.profileFeatureStore.read(),
      inputs: this.inputs,
      refreshAll: () => this.reloadAll(),
      refreshDesktopState: (options) => this.refreshDesktopState(options),
      setProfileFeatureEnabled: (enabled) => this.profileFeatureStore.write(enabled),
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
    new DesktopIpcProfileRoutes({
      applyProfile: async (profileId) => await this.profileManager.apply(profileId),
      createProfile: (name, emoji, assignments) => this.profileManager.create(name, emoji, assignments),
      deleteProfile: (profileId) => this.profileManager.delete(profileId),
      inputs: this.inputs,
      listProfiles: () => this.profileManager.list(),
      refreshAll: () => this.invalidateAndReloadAll(),
      updateProfile: (profileId, name, emoji, assignments) => this.profileManager.update(profileId, name, emoji, assignments),
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

  private invalidateAndReloadAll(): void {
    void this.refreshDesktopState({
      invalidate: true,
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

  private resetDesktopLocalState(): void {
    this.connectionManager.clearPreparedConnectionDrafts();
    const next = mergeAgentHomes(this.options.agentHomes, {});
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

  private refreshMenubarUsage(): Promise<void> {
    return this.stateRefresher.refreshMenubarUsage();
  }
}
