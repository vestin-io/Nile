import { app } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { StateReset } from "@nile/builtins/local";
import type { AgentHomes, AgentRuntimeCommandOverrides } from "@nile/core/models/agent";
import { mergeAgentHomes, type AgentId } from "@nile/core/models/agent";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import {
  BackendCredentialStore,
  type CredentialStore,
  WindowsCredentialManagerStore,
} from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import { ShellEnvironment } from "@nile/host-local";

import { DesktopSurface } from "../../state/Surface";
import { DesktopApplicationMenu } from "./DesktopApplicationMenu";
import { AgentHomesStore } from "../state/AgentHomesStore";
import { AgentRuntimeCommandsStore } from "../state/AgentRuntimeCommandsStore";
import { AutoUpdateManager } from "../updates/AutoUpdateManager";
import { ConnectionUsageAlertEvaluator } from "../alerts/Evaluator";
import { ConnectionAlertOverlay } from "../alerts/Overlay";
import { ConnectionAlertStore } from "../alerts/Store";
import { DesktopConnectionGateway } from "../connections/DesktopConnectionGateway";
import { DesktopConnectionManager } from "../connections/DesktopConnectionManager";
import { ManagedApiKeyEnvironment } from "../connections/ManagedApiKeyEnvironment";
import { DesktopOpenClawEnvironmentReader } from "../environment/OpenClaw";
import { DesktopEnvironmentSource } from "../environment/Source";
import { DesktopShellEnvironment } from "../environment/Shell";
import { DesktopEnvironmentStore, readDesktopEnvironmentStorePath } from "../environment/Store";
import { DesktopIpcAppRoutes } from "../ipc/DesktopIpcAppRoutes";
import { DesktopIpcConnectionRoutes } from "../ipc/DesktopIpcConnectionRoutes";
import { DesktopIpcInputValidator } from "../ipc/DesktopIpcInputValidator";
import { DesktopIpcProfileRoutes } from "../ipc/DesktopIpcProfileRoutes";
import { DesktopIpcStateRoutes } from "../ipc/DesktopIpcStateRoutes";
import { DesktopIpcUpdateRoutes } from "../ipc/DesktopIpcUpdateRoutes";
import { MacNotificationCenter } from "../notifications/Center";
import { DesktopNotificationHistory } from "../notifications/History";
import { DesktopNotificationService } from "../notifications/Service";
import { WorkspaceProfileManager } from "../profiles/Manager";
import { WorkspaceProfileStore } from "../profiles/Store";
import { DesktopShell } from "./DesktopShell";
import { DesktopTrayMenu } from "./TrayMenu";
import { DesktopStateReset } from "../state/Reset";
import { DesktopLanguageStore } from "../state/LanguageStore";
import { DesktopNotificationMuteStore } from "../state/NotificationMuteStore";
import { DesktopProfileFeatureStore } from "../state/ProfileFeatureStore";
import { DesktopStatusEntryDisplayStore } from "../state/StatusEntryDisplayStore";
import { DesktopStateRefresher } from "../state/DesktopStateRefresher";
import { DesktopStateStore } from "../state/DesktopStateStore";
import { DesktopWorkspaceWatcher } from "./DesktopWorkspaceWatcher";
import { readDesktopPlatformCapabilities } from "./PlatformCapabilities";
import { DesktopStatusEntrySummary } from "./StatusEntrySummary";
import { DesktopStatusEntryTitle } from "./StatusEntryTitle";

const currentDir = typeof __dirname === "string" ? __dirname : dirname(fileURLToPath(import.meta.url));

type DesktopMainOptions = { databasePath: string; agentHomes?: AgentHomes; credentialStore?: CredentialStore };

export class DesktopMain {
  private readonly logger: NileLogger;
  private readonly credentialStore: CredentialStore;
  private readonly environment: EnvironmentSource;
  private readonly environmentStore: DesktopEnvironmentStore;
  private readonly shellEnvironment: DesktopShellEnvironment;
  private readonly agentHomesStore: AgentHomesStore;
  private readonly agentRuntimeCommandsStore: AgentRuntimeCommandsStore;
  private readonly statusEntryDisplayStore: DesktopStatusEntryDisplayStore;
  private readonly languageStore: DesktopLanguageStore;
  private readonly notificationMuteStore: DesktopNotificationMuteStore;
  private readonly profileFeatureStore: DesktopProfileFeatureStore;
  private readonly profileStore: WorkspaceProfileStore;
  private readonly connectionAlertStore: ConnectionAlertStore;
  private readonly notificationHistory: DesktopNotificationHistory;
  private readonly profileManager: WorkspaceProfileManager;
  private readonly agentHomes: AgentHomes;
  private readonly agentRuntimeCommandOverrides: AgentRuntimeCommandOverrides;
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
  private readonly notifications: DesktopNotificationService;
  private readonly inputs = new DesktopIpcInputValidator();
  private isQuitting = false;

  constructor(private readonly options: DesktopMainOptions) {
    this.logger = NileLogger.createDefault({ module: "desktop-main" });
    this.credentialStore = options.credentialStore ?? createDesktopCredentialStore(options.databasePath);
    this.environmentStore = new DesktopEnvironmentStore(options.databasePath);
    this.shellEnvironment = new DesktopShellEnvironment();
    this.environment = new DesktopEnvironmentSource(
      new ShellEnvironment().readLoginShellEnvironment(),
      this.environmentStore,
    );
    this.agentHomesStore = new AgentHomesStore(options.databasePath);
    this.agentRuntimeCommandsStore = new AgentRuntimeCommandsStore(options.databasePath);
    this.statusEntryDisplayStore = new DesktopStatusEntryDisplayStore(options.databasePath);
    this.languageStore = new DesktopLanguageStore(options.databasePath);
    this.notificationMuteStore = new DesktopNotificationMuteStore(options.databasePath);
    this.profileFeatureStore = new DesktopProfileFeatureStore(options.databasePath);
    this.profileStore = new WorkspaceProfileStore(options.databasePath);
    this.connectionAlertStore = new ConnectionAlertStore(options.databasePath);
    this.notificationHistory = new DesktopNotificationHistory(options.databasePath);
    this.agentHomes = mergeAgentHomes(options.agentHomes, this.agentHomesStore.read());
    this.agentRuntimeCommandOverrides = this.agentRuntimeCommandsStore.read();
    this.surface = new DesktopSurface({
      databasePath: options.databasePath,
      agentHomes: this.agentHomes,
      agentRuntimeCommandOverrides: this.agentRuntimeCommandOverrides,
      environment: this.environment,
      credentialStore: this.credentialStore,
      logger: this.logger.child({ scope: "desktop-surface" }),
    });
    this.connectionManager = new DesktopConnectionManager({
      databasePath: options.databasePath,
      agentHomes: this.agentHomes,
      agentRuntimeCommandOverrides: this.agentRuntimeCommandOverrides,
      environment: this.environment,
      openExternalUrl: async (url) => await this.shell.openExternalUrl(url),
      managedApiKeyEnvironment: new ManagedApiKeyEnvironment(
        this.environmentStore,
        this.shellEnvironment,
        this.logger.child({ scope: "managed-api-key-environment", path: "connection-manager" }),
      ),
      credentialStore: this.credentialStore,
      credentialStorageSession: this.credentialStore instanceof BackendCredentialStore
        ? this.credentialStore
        : undefined,
    });
    this.connectionGateway = new DesktopConnectionGateway({
      databasePath: options.databasePath,
      agentHomes: this.agentHomes,
      environment: this.environment,
      managedApiKeyEnvironment: new ManagedApiKeyEnvironment(
        this.environmentStore,
        this.shellEnvironment,
        this.logger.child({ scope: "managed-api-key-environment", path: "connection-gateway" }),
      ),
      credentialStore: this.credentialStore,
      credentialStorageSession: this.credentialStore instanceof BackendCredentialStore
        ? this.credentialStore
        : undefined,
      logger: this.logger.child({ scope: "connection-gateway" }),
    });
    this.stateStore = new DesktopStateStore({
      databasePath: options.databasePath,
      surface: this.surface,
      connectionGateway: this.connectionGateway,
      connectionManager: this.connectionManager,
      stateReset: new DesktopStateReset({
        localStatePaths: [
          join(dirname(options.databasePath), "credentials"),
          readDesktopEnvironmentStorePath(options.databasePath),
        ],
        onBeforeResetLocalState: () => this.clearManagedApiKeyEnvironment(),
        onResetLocalState: () => this.resetDesktopLocalState(),
        stateReset: new StateReset(this.credentialStore),
      }),
      connectionAlertOverlay: new ConnectionAlertOverlay(this.connectionAlertStore),
      connectionAlertStore: this.connectionAlertStore,
      notificationHistory: this.notificationHistory,
      logger: this.logger.child({ scope: "state-store" }),
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
      onTraySummaryMenuRequested: async () => await this.trayMenu.readSummaryTemplate(),
      onTrayMenuRequested: async () => await this.trayMenu.readTemplate(),
      shouldHideOnClose: () => !this.isQuitting,
    });
    this.notifications = new DesktopNotificationService({
      center: new MacNotificationCenter(),
      history: this.notificationHistory,
      isMuted: () => this.notificationMuteStore.read(),
      logger: this.logger.child({ scope: "notifications" }),
      notifyHistoryChanged: () => this.shell.notifyNotificationHistoryChanged(),
      openTarget: (target) => this.shell.showSettingsTarget(target),
    });
    this.trayMenu = new DesktopTrayMenu({
      logger: this.logger,
      peekState: () => this.stateStore.peekStatusEntryState(),
      peekSettingsState: () => this.stateStore.peekSettingsState(),
      isProfileFeatureEnabled: () => this.profileFeatureStore.read(),
      readLanguagePreference: () => this.languageStore.read(),
      readConnectionQuotaMetricPreferences: () => this.shell.readConnectionQuotaMetricPreferences(),
      readStatusEntryDisplay: () => this.statusEntryDisplayStore.read(),
      refreshState: async () => await this.stateStore.refreshStatusEntryState(),
      refreshSettingsState: async () => await this.stateStore.getSettingsState({ refreshUsage: false }),
      listProfiles: () => this.profileManager.list(),
      notify: (intent) => {
        this.notifications.notify(intent);
      },
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
      toggleSelectedAgent: (agentId) => {
        this.toggleStatusEntrySelectedAgent(agentId);
        this.syncTrayTitle();
      },
    });
    this.stateRefresher = new DesktopStateRefresher({
      alertEvaluator: new ConnectionUsageAlertEvaluator({
        notify: (intent) => {
          this.notifications.notify(intent);
        },
      }),
      logger: this.logger,
      notifyRenderer: () => {
        this.shell.notifyStateChanged();
        this.syncTrayTitle();
      },
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
    const initialLanguagePreference = await this.shell.attach();
    if (initialLanguagePreference) {
      this.languageStore.write(initialLanguagePreference);
    }
    if (process.platform !== "darwin") {
      this.shell.showSettings();
    }
    this.syncTrayTitle();
    await this.syncManagedApiKeyEnvironment();
    this.workspaceWatcher.start();
    void this.stateStore.primeStartupState().catch((error) => {
      this.logger.error("desktop.startup.prime_state_failed", error);
    });
    setTimeout(() => {
      if (this.isQuitting) {
        return;
      }
      void this.refreshStatusEntryUsage().catch((error) => {
        this.logger.error("desktop.startup.refresh_usage_failed", error);
      });
    }, 1500);
    void this.autoBindCursorUsageInBackground();

    app.on("before-quit", () => {
      this.isQuitting = true;
      this.connectionManager.clearPreparedConnectionDrafts();
      if (this.credentialStore instanceof BackendCredentialStore) {
        this.credentialStore.clearUnlockedCredentials();
      }
      this.workspaceWatcher.stop();
    });
    app.on("activate", () => {
      this.shell.showSettings();
    });
  }

  private registerIpcRoutes(): void {
    new DesktopIpcStateRoutes({
      getStatusEntryDisplay: () => this.statusEntryDisplayStore.read(),
      getNotificationsMuted: () => this.notificationMuteStore.read(),
      getProfileFeatureEnabled: () => this.profileFeatureStore.read(),
      inputs: this.inputs,
      notifyLocalStateReset: () => this.shell.notifyLocalStateReset(),
      notifyNotificationHistoryChanged: () => this.shell.notifyNotificationHistoryChanged(),
      refreshAll: () => this.reloadAll(),
      refreshDesktopState: (options) => this.refreshDesktopState(options),
      setLanguagePreference: (language) => this.languageStore.write(language),
      setStatusEntryDisplayMode: (mode) => {
        const next = this.statusEntryDisplayStore.writeMode(mode);
        this.syncTrayTitle();
        return next;
      },
      setNotificationsMuted: (muted) => this.notificationMuteStore.write(muted),
      setProfileFeatureEnabled: (enabled) => this.profileFeatureStore.write(enabled),
      stateStore: this.stateStore,
      toggleStatusEntrySelectedAgent: (agentId) => {
        const next = this.toggleStatusEntrySelectedAgent(agentId);
        this.syncTrayTitle();
        return next;
      },
      updateAgentHome: (agentId, path) => this.updateAgentHome(agentId, path),
      updateAgentRuntimeCommand: (agentId, path) => this.updateAgentRuntimeCommand(agentId, path),
    }).register();
    new DesktopIpcConnectionRoutes({
      chooseOpenAiAuthJsonPath: (defaultPath) => this.shell.chooseOpenAiAuthJsonPath(defaultPath),
      connectionManager: this.connectionManager,
      inputs: this.inputs,
      logger: this.logger.child({ scope: "ipc-connection-routes" }),
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
      installDesktopUpdate: () => this.installDesktopUpdate(),
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

  private installDesktopUpdate() { this.isQuitting = true; this.shell.prepareForUpdateInstall(); return this.autoUpdateManager.installUpdate(); }

  private updateAgentHome(agentId: AgentId, path: string | null): void {
    const next = mergeAgentHomes(this.options.agentHomes, this.agentHomesStore.update(agentId, path));
    for (const key of Object.keys(this.agentHomes) as AgentId[]) {
      delete this.agentHomes[key];
    }
    Object.assign(this.agentHomes, next);
  }

  private updateAgentRuntimeCommand(agentId: AgentId, path: string | null): void {
    const next = this.agentRuntimeCommandsStore.update(agentId, path);
    for (const key of Object.keys(this.agentRuntimeCommandOverrides) as AgentId[]) {
      delete this.agentRuntimeCommandOverrides[key];
    }
    Object.assign(this.agentRuntimeCommandOverrides, next);
  }

  private resetDesktopLocalState(): void {
    this.connectionManager.clearPreparedConnectionDrafts();
    this.connectionAlertStore.clearCache();
    if (this.credentialStore instanceof BackendCredentialStore) {
      this.credentialStore.clearUnlockedCredentials();
    }
    this.agentRuntimeCommandsStore.clear();
    const next = mergeAgentHomes(this.options.agentHomes, {});
    for (const key of Object.keys(this.agentHomes) as AgentId[]) {
      delete this.agentHomes[key];
    }
    Object.assign(this.agentHomes, next);
    for (const key of Object.keys(this.agentRuntimeCommandOverrides) as AgentId[]) {
      delete this.agentRuntimeCommandOverrides[key];
    }
  }

  private clearManagedApiKeyEnvironment(): void {
    const session = this.connectionGateway.openSession();
    try {
      const preservedEnvKeys = this.readManagedOpenClawEnvKeys();
      const managedEnvironment = new ManagedApiKeyEnvironment(this.environmentStore, this.shellEnvironment);
      managedEnvironment.clearForSession(session, [...preservedEnvKeys]);
    } finally {
      session.close();
    }
  }

  private async syncManagedApiKeyEnvironment(): Promise<void> {
    const session = this.connectionGateway.openSession();
    try {
      const preservedEnvKeys = [...this.readManagedOpenClawEnvKeys()];
      const managedEnvironment = new ManagedApiKeyEnvironment(this.environmentStore, this.shellEnvironment);
      for (const failure of managedEnvironment.syncForSession(session, preservedEnvKeys)) {
        this.logger.warn("desktop.managed_env.sync_failed", {
          connectionId: failure.connectionId,
          error: failure.error.message,
        });
      }
    } finally {
      session.close();
    }
  }

  private readManagedOpenClawEnvKeys(): Set<string> {
    const openclawHome = this.agentHomes.openclaw;
    if (!openclawHome) {
      return new Set();
    }
    try {
      return new Set(new DesktopOpenClawEnvironmentReader(openclawHome).readManagedEnvKeys());
    } catch (error) {
      this.logger.warn("desktop.openclaw.managed_config_read_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return new Set();
    }
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

  private refreshStatusEntryUsage(): Promise<void> {
    return this.stateRefresher.refreshStatusEntryUsage();
  }

  private toggleStatusEntrySelectedAgent(agentId: AgentId) {
    const preferences = this.statusEntryDisplayStore.read();
    const nextSelectedAgentIds = DesktopStatusEntryTitle.toggleSelectedAgentIds(
      this.stateStore.peekStatusEntryState(),
      preferences,
      agentId,
    );
    return this.statusEntryDisplayStore.writeSelectedAgentIds(nextSelectedAgentIds);
  }

  private syncTrayTitle(): void { void this.syncTrayTitleAsync(); }

  private async syncTrayTitleAsync(): Promise<void> {
    const connectionQuotaMetricPreferences = await this.shell.readConnectionQuotaMetricPreferences().catch(() => ({}));
    const state = this.stateStore.peekStatusEntryState();
    const preferences = this.statusEntryDisplayStore.read();
    const platformCapabilities = readDesktopPlatformCapabilities(process.platform);

    if (platformCapabilities.supportsTitleTicker) {
      this.shell.setTrayTitle(
        DesktopStatusEntryTitle.format(
          state,
          preferences,
          connectionQuotaMetricPreferences,
        ),
      );
    }
    if (platformCapabilities.supportsTraySummary) {
      this.shell.setTrayToolTip(
        DesktopStatusEntrySummary.formatTrayTooltip(
          "Nile",
          state,
          preferences,
          connectionQuotaMetricPreferences,
        ),
      );
    }
  }
}

function createDesktopCredentialStore(databasePath: string): CredentialStore {
  if (process.platform === "darwin") {
    return new BackendCredentialStore(databasePath);
  }

  if (process.platform === "win32") {
    return new BackendCredentialStore(databasePath, new WindowsCredentialManagerStore());
  }

  return new BackendCredentialStore(databasePath);
}
