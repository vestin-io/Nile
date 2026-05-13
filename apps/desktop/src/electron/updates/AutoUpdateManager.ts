import { autoUpdater, type Event } from "electron";
import { UpdateSourceType, type IUpdateElectronAppOptions, type ILogger, updateElectronApp } from "update-electron-app";

import type { NileLogger } from "@nile/core/services/NileLogger";
import type {
  DesktopInstallUpdateResult,
  DesktopReleaseInfo,
  DesktopReleaseStatus,
  DesktopUpdateAvailability,
  DesktopUpdateCheckResult,
} from "../../state/Types";
import {
  createAutoUpdaterLogger,
  extractAutoUpdateVersion,
  readDesktopUpdateAvailability,
} from "./AutoUpdateSupport";

type AutoUpdateLogger = Pick<NileLogger, "debug" | "info" | "warn" | "error">;
type RunAutoUpdate = (options: IUpdateElectronAppOptions<ILogger>) => void;
type AutoUpdaterLike = {
  on(event: "checking-for-update", listener: () => void): AutoUpdaterLike;
  on(event: "update-available", listener: () => void): AutoUpdaterLike;
  on(event: "update-not-available", listener: () => void): AutoUpdaterLike;
  on(event: "error", listener: (error: Error) => void): AutoUpdaterLike;
  on(
    event: "update-downloaded",
    listener: (event: Event, releaseNotes: string, releaseName: string, releaseDate: Date, updateURL: string) => void,
  ): AutoUpdaterLike;
  checkForUpdates(): void;
  quitAndInstall(): void;
};

type AutoUpdateManagerOptions = {
  logger: AutoUpdateLogger;
  isPackaged?: boolean;
  platform?: NodeJS.Platform;
  runAutoUpdate?: RunAutoUpdate;
  scheduleTask?: (task: () => void) => void;
  updater?: AutoUpdaterLike;
  version?: string;
  onReleaseInfoChanged?: () => void;
};

export class AutoUpdateManager {
  private static readonly repository = "vestin-io/Nile";
  private readonly logger: AutoUpdateLogger;
  private readonly isPackaged: boolean;
  private readonly platform: NodeJS.Platform;
  private readonly runAutoUpdate: RunAutoUpdate;
  private readonly scheduleTask: (task: () => void) => void;
  private readonly updater: AutoUpdaterLike;
  private readonly version: string;
  private readonly onReleaseInfoChanged: () => void;
  private hasStarted = false;
  private hasScheduledStart = false;
  private listenersBound = false;
  private status: DesktopReleaseStatus = "idle";
  private availableVersion: string | null = null;
  private errorMessage: string | null = null;

  constructor(options: AutoUpdateManagerOptions) {
    this.logger = options.logger;
    this.isPackaged = options.isPackaged ?? false;
    this.platform = options.platform ?? process.platform;
    this.runAutoUpdate = options.runAutoUpdate ?? updateElectronApp;
    this.scheduleTask = options.scheduleTask ?? ((task) => {
      setTimeout(task, 0);
    });
    this.updater = options.updater ?? autoUpdater;
    this.version = options.version?.trim() || "0.0.0";
    this.onReleaseInfoChanged = options.onReleaseInfoChanged ?? (() => {});
  }

  start(): void {
    if (this.hasStarted || this.hasScheduledStart) {
      return;
    }

    const updateAvailability = this.readUpdateAvailability();
    if (updateAvailability !== "available") {
      if (updateAvailability === "development") {
        this.logger.debug("desktop.auto_update.skipped_unpacked", {});
      } else {
        this.logger.info("desktop.auto_update.skipped_platform", { platform: this.platform });
      }
      return;
    }

    this.hasScheduledStart = true;
    this.scheduleTask(() => {
      this.hasScheduledStart = false;
      this.startInBackground();
    });
    this.logger.debug("desktop.auto_update.scheduled", {
      platform: this.platform,
      repo: AutoUpdateManager.repository,
    });
  }

  getReleaseInfo(): DesktopReleaseInfo {
    return {
      version: this.version,
      updateAvailability: this.readUpdateAvailability(),
      status: this.status,
      availableVersion: this.availableVersion,
      errorMessage: this.errorMessage,
    };
  }

  checkForUpdates(): DesktopUpdateCheckResult {
    if (this.readUpdateAvailability() !== "available") {
      return { status: "unavailable" };
    }

    if (!this.hasStarted) {
      this.startInBackground();
    }

    if (!this.hasStarted) {
      return { status: "unavailable" };
    }

    if (this.status === "checking") {
      return { status: "started" };
    }

    this.updateReleaseState({
      status: "checking",
      availableVersion: this.availableVersion,
      errorMessage: null,
    });

    try {
      this.updater.checkForUpdates();
      this.logger.info("desktop.auto_update.manual_check_started", {
        platform: this.platform,
        repo: AutoUpdateManager.repository,
      });
      return { status: "started" };
    } catch (error) {
      this.logger.warn("desktop.auto_update.manual_check_unavailable", {
        platform: this.platform,
        repo: AutoUpdateManager.repository,
        error: error instanceof Error ? error.message : String(error),
      });
      this.updateReleaseState({
        status: "error",
        availableVersion: this.availableVersion,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return { status: "unavailable" };
    }
  }

  installUpdate(): DesktopInstallUpdateResult {
    if (this.status !== "ready") {
      return { status: "unavailable" };
    }

    try {
      this.logger.info("desktop.auto_update.install_started", {
        platform: this.platform,
        repo: AutoUpdateManager.repository,
        version: this.availableVersion,
      });
      this.updater.quitAndInstall();
      return { status: "started" };
    } catch (error) {
      this.logger.warn("desktop.auto_update.install_unavailable", {
        platform: this.platform,
        repo: AutoUpdateManager.repository,
        error: error instanceof Error ? error.message : String(error),
      });
      return { status: "unavailable" };
    }
  }

  private startInBackground(): void {
    if (this.hasStarted) {
      return;
    }

    this.bindUpdaterEvents();

    try {
      this.runAutoUpdate({
        logger: createAutoUpdaterLogger(this.logger),
        notifyUser: false,
        updateSource: {
          type: UpdateSourceType.ElectronPublicUpdateService,
          repo: AutoUpdateManager.repository,
        },
      });
      this.hasStarted = true;
      this.logger.info("desktop.auto_update.started", {
        platform: this.platform,
        repo: AutoUpdateManager.repository,
      });
    } catch (error) {
      this.logger.warn("desktop.auto_update.start_failed", {
        platform: this.platform,
        repo: AutoUpdateManager.repository,
        error: error instanceof Error ? error.message : String(error),
      });
      this.updateReleaseState({
        status: "error",
        availableVersion: this.availableVersion,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private bindUpdaterEvents(): void {
    if (this.listenersBound) {
      return;
    }

    this.listenersBound = true;
    this.updater.on("checking-for-update", () => {
      this.updateReleaseState({
        status: "checking",
        availableVersion: this.availableVersion,
        errorMessage: null,
      });
    });
    this.updater.on("update-available", () => {
      this.updateReleaseState({
        status: "downloading",
        availableVersion: this.availableVersion,
        errorMessage: null,
      });
    });
    this.updater.on("update-not-available", () => {
      this.updateReleaseState({
        status: "up_to_date",
        availableVersion: null,
        errorMessage: null,
      });
    });
    this.updater.on("update-downloaded", (_event, _releaseNotes, releaseName, _releaseDate, updateURL) => {
      this.updateReleaseState({
        status: "ready",
        availableVersion: extractAutoUpdateVersion(releaseName, updateURL),
        errorMessage: null,
      });
    });
    this.updater.on("error", (error) => {
      this.logger.warn("desktop.auto_update.fetch_failed", {
        error: error.message,
        platform: this.platform,
        repo: AutoUpdateManager.repository,
      });
      this.updateReleaseState({
        status: "error",
        availableVersion: this.availableVersion,
        errorMessage: error.message,
      });
    });
  }

  private updateReleaseState(next: {
    status: DesktopReleaseStatus;
    availableVersion: string | null;
    errorMessage: string | null;
  }): void {
    const changed =
      this.status !== next.status ||
      this.availableVersion !== next.availableVersion ||
      this.errorMessage !== next.errorMessage;
    this.status = next.status;
    this.availableVersion = next.availableVersion;
    this.errorMessage = next.errorMessage;
    if (changed) {
      this.onReleaseInfoChanged();
    }
  }

  private readUpdateAvailability(): DesktopUpdateAvailability {
    return readDesktopUpdateAvailability(this.isPackaged, this.version, this.platform);
  }
}
