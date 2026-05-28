import { app } from "electron";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { StateReset } from "@nile/builtins/local";
import type { AgentHomes, AgentRuntimeCommandOverrides } from "@nile/core/models/agent";
import { mergeAgentHomes, type AgentId } from "@nile/core/models/agent";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import {
  createPlatformWorkspaceCredentialStore,
  type CredentialStore,
  isCredentialStorageSession,
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
import { DesktopCredentialStorageSession } from "../connections/CredentialStorageSession";
import { DesktopPortableTransferGateway } from "../connections/PortableTransferGateway";
import { ManagedApiKeyEnvironment } from "../connections/ManagedApiKeyEnvironment";
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
import { DesktopPreferencesStore } from "../state/DesktopPreferencesStore";
import { DesktopNotificationMuteStore } from "../state/NotificationMuteStore";
import { DesktopProfileFeatureStore } from "../state/ProfileFeatureStore";
import { DesktopStatusEntryDisplayStore } from "../state/StatusEntryDisplayStore";
import { DesktopStateRefresher } from "../state/DesktopStateRefresher";
import { DesktopStateStore } from "../state/DesktopStateStore";
import { DesktopWorkspaceWatcher } from "./DesktopWorkspaceWatcher";
import { DesktopManagedEnvironmentLifecycle } from "./ManagedEnvironmentLifecycle";
import { DesktopStatusEntryController } from "./StatusEntryController";
import { DesktopUsageAutoRefresh } from "./UsageAutoRefresh";

const currentDir = typeof __dirname === "string" ? __dirname : dirname(fileURLToPath(import.meta.url));

type DesktopMainOptions = { databasePath: string; agentHomes?: AgentHomes; credentialStore?: CredentialStore };

export class DesktopMain {
  private readonly logger: NileLogger;
  private readonly credentialStore: CredentialStore;
  private readonly environment: EnvironmentSource;
  private readonly environmentStore: DesktopEnvironmentStore;
  private readonly shellEnvironment: DesktopShellEnvironment;
  private readonly credentialStorageSession: DesktopCredentialStorageSession;
  private readonly agentHomesStore: AgentHomesStore;
  private readonly agentRuntimeCommandsStore: AgentRuntimeCommandsStore;
  private readonly statusEntryDisplayStore: DesktopStatusEntryDisplayStore;
  private readonly preferencesStore: DesktopPreferencesStore;
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
  private readonly portableTransferGateway: DesktopPortableTransferGateway;
  private readonly stateStore: DesktopStateStore;
  private readonly stateRefresher: DesktopStateRefresher;
  private readonly workspaceWatcher: DesktopWorkspaceWatcher;
  private readonly shell: DesktopShell;
  private readonly trayMenu: DesktopTrayMenu;
  private readonly autoUpdateManager: AutoUpdateManager;
  private readonly applicationMenu: DesktopApplicationMenu;
  private readonly notifications: DesktopNotificationService;
  private readonly managedEnvironmentLifecycle: DesktopManagedEnvironmentLifecycle;
  private readonly statusEntryController: DesktopStatusEntryController;
  private readonly usageAutoRefresh: DesktopUsageAutoRefresh;
  private readonly inputs = new DesktopIpcInputValidator();
  private isQuitting = false;

  constructor(private readonly options: DesktopMainOptions) {
    this.logger = NileLogger.createDefault({ module: "desktop-main" });
    this.credentialStore = options.credentialStore ?? createDesktopCredentialStore(options.databasePath);
    this.environmentStore = new DesktopEnvironmentStore(options.databasePath);
    this.shellEnvironment = new DesktopShellEnvironment();
    this.credentialStorageSession = new DesktopCredentialStorageSession(
      isCredentialStorageSession(this.credentialStore) ? this.credentialStore : null,
    );
    this.environment = new DesktopEnvironmentSource(
      new ShellEnvironment().readLoginShellEnvironment(),
      this.environmentStore,
    );
    this.agentHomesStore = new AgentHomesStore(options.databasePath);
    this.agentRuntimeCommandsStore = new AgentRuntimeCommandsStore(options.databasePath);
    this.statusEntryDisplayStore = new DesktopStatusEntryDisplayStore(options.databasePath);
    this.preferencesStore = new DesktopPreferencesStore(options.databasePath);
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
      credentialStorageSession: this.credentialStorageSession,
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
      credentialStorageSession: this.credentialStorageSession,
      logger: this.logger.child({ scope: "connection-gateway" }),
    });
    this.portableTransferGateway = new DesktopPortableTransferGateway({
      appVersion: readDesktopPackageVersion(),
      credentialStore: this.credentialStore,
      credentialStorageSession: this.credentialStorageSession,
      databasePath: options.databasePath,
      openSession: () => this.connectionGateway.openSession(),
      platform: process.platform,
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
    this.managedEnvironmentLifecycle = new DesktopManagedEnvironmentLifecycle({
      agentHomes: this.agentHomes,
      environment: new ManagedApiKeyEnvironment(this.environmentStore, this.shellEnvironment),
      logger: this.logger,
      openSession: () => this.connectionGateway.openSession(),
    });
    this.trayMenu = new DesktopTrayMenu({
      logger: this.logger,
      peekState: () => this.stateStore.peekStatusEntryState(),
      peekSettingsState: () => this.stateStore.peekSettingsState(),
      isProfileFeatureEnabled: () => this.profileFeatureStore.read(),
      readLanguagePreference: () => this.preferencesStore.read().language,
      readConnectionQuotaMetricPreferences: async () => this.preferencesStore.read().connectionQuotaMetricPreferences,
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
        this.statusEntryController.toggleSelectedAgent(agentId);
        this.statusEntryController.sync();
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
        this.statusEntryController.sync();
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
    this.statusEntryController = new DesktopStatusEntryController({
      appName: "Nile",
      platform: process.platform,
      readConnectionQuotaMetricPreferences: () => this.preferencesStore.read().connectionQuotaMetricPreferences,
      readDisplayState: () => this.statusEntryDisplayStore.read(),
      readStatusEntryState: () => this.stateStore.peekStatusEntryState(),
      shell: this.shell,
      writeSelectedAgentIds: (agentIds) => this.statusEntryDisplayStore.writeSelectedAgentIds(agentIds),
    });
    this.usageAutoRefresh = new DesktopUsageAutoRefresh({
      logger: this.logger.child({ scope: "usage-auto-refresh" }),
      refreshAutomaticUsage: async (options) => await this.stateRefresher.refreshAutomaticUsage(options),
    });
  }

  async start(): Promise<void> {
    app.setName("Nile");
    await app.whenReady();
    this.autoUpdateManager.start();
    this.applicationMenu.configureAboutPanel();
    this.applicationMenu.install();
    this.registerIpcRoutes();
    await this.shell.attach();
    if (process.platform !== "darwin") {
      this.shell.showSettings();
    }
    this.statusEntryController.sync();
    await this.managedEnvironmentLifecycle.syncStartup();
    this.workspaceWatcher.start();
    void this.stateStore.primeStartupState().catch((error) => {
      this.logger.error("desktop.startup.prime_state_failed", error);
    });
    this.usageAutoRefresh.start();
    void this.autoBindCursorUsageInBackground();

    app.on("before-quit", () => {
      this.isQuitting = true;
      this.connectionManager.clearPreparedConnectionDrafts();
      this.credentialStorageSession.clearUnlockedCredentials();
      this.workspaceWatcher.stop();
      this.usageAutoRefresh.stop();
    });
    app.on("activate", () => {
      this.shell.showSettings();
    });
  }

  private registerIpcRoutes(): void {
    new DesktopIpcStateRoutes({
      getDesktopPreferences: () => this.preferencesStore.read(),
      getStatusEntryDisplay: () => this.statusEntryDisplayStore.read(),
      getNotificationsMuted: () => this.notificationMuteStore.read(),
      getProfileFeatureEnabled: () => this.profileFeatureStore.read(),
      inputs: this.inputs,
      notifyLocalStateReset: () => this.shell.notifyLocalStateReset(),
      notifyNotificationHistoryChanged: () => this.shell.notifyNotificationHistoryChanged(),
      notifyPreferencesChanged: () => this.shell.notifyPreferencesChanged(),
      refreshAll: () => this.reloadAll(),
      refreshDesktopState: (options) => this.refreshDesktopState(options),
      migrateDesktopPreferences: (raw) => {
        const next = this.preferencesStore.migrateLegacy(raw);
        this.statusEntryController.sync();
        return next;
      },
      setDesktopPreferences: (preferences) => {
        const next = this.preferencesStore.write(preferences);
        this.statusEntryController.sync();
        return next;
      },
      setLanguagePreference: (language) => this.preferencesStore.write({
        ...this.preferencesStore.read(),
        language,
      }).language,
      setStatusEntryDisplayMode: (mode) => {
        const next = this.statusEntryDisplayStore.writeMode(mode);
        this.statusEntryController.sync();
        return next;
      },
      setNotificationsMuted: (muted) => this.notificationMuteStore.write(muted),
      setProfileFeatureEnabled: (enabled) => this.profileFeatureStore.write(enabled),
      stateStore: this.stateStore,
      toggleStatusEntrySelectedAgent: (agentId) => {
        const next = this.statusEntryController.toggleSelectedAgent(agentId);
        this.statusEntryController.sync();
        return next;
      },
      updateAgentHome: (agentId, path) => this.updateAgentHome(agentId, path),
      updateAgentRuntimeCommand: (agentId, path) => this.updateAgentRuntimeCommand(agentId, path),
    }).register();
    new DesktopIpcConnectionRoutes({
      chooseOpenAiAuthJsonPath: (defaultPath) => this.shell.chooseOpenAiAuthJsonPath(defaultPath),
      chooseCredentialExportPath: (defaultFileName) => this.shell.chooseCredentialExportPath(defaultFileName),
      chooseCredentialImportPath: (defaultPath) => this.shell.chooseCredentialImportPath(defaultPath),
      connectionManager: this.connectionManager,
      getCredentialStorageModeState: () => this.portableTransferGateway.readStorageModeState(),
      inputs: this.inputs,
      logger: this.logger.child({ scope: "ipc-connection-routes" }),
      previewCredentialExport: (input) => this.portableTransferGateway.previewExport(input),
      exportCredentialBundle: (input) => this.portableTransferGateway.exportBundle(input),
      previewCredentialImport: (input) => this.portableTransferGateway.previewImport(input),
      applyCredentialImport: async (input) => await this.portableTransferGateway.applyImport(input),
      refreshAll: () => this.reloadAll(),
      refreshDesktopState: async (options) => await this.refreshDesktopState(options),
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
      quitApp: () => app.quit(),
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
    this.credentialStorageSession.clearUnlockedCredentials();
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

  private async refreshDesktopState(options: {
    forceStatusEntryUsageRefresh?: boolean;
    invalidate: boolean;
    notifyRenderer: boolean;
    refreshSettingsUsage?: boolean;
    refreshStatusEntryUsage?: boolean;
    usageRefreshMode?: "auto" | "manual";
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

  private clearManagedApiKeyEnvironment(): void {
    this.managedEnvironmentLifecycle.clearBeforeReset();
  }
}

function readDesktopPackageVersion(): string {
  const packageJsonPath = join(currentDir, "..", "..", "package.json");
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  return parsed.version?.trim() || "0.0.0";
}

function createDesktopCredentialStore(databasePath: string): CredentialStore {
  return createPlatformWorkspaceCredentialStore(databasePath);
}
