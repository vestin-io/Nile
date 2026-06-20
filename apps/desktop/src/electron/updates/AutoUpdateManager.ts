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
  buildElectronUpdateFeedUrl,
  createAutoUpdaterLogger,
  extractAutoUpdateVersion,
  fetchElectronUpdateFeedRelease,
  isReleaseVersionNewer,
  readDesktopUpdateAvailability,
  type ElectronUpdateFeedRelease,
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
type FetchUpdateFeedRelease = typeof fetchElectronUpdateFeedRelease;

type AutoUpdateManagerOptions = {
  enabled?: boolean;
  logger: AutoUpdateLogger;
  isPackaged?: boolean;
  platform?: NodeJS.Platform;
  arch?: string;
  runAutoUpdate?: RunAutoUpdate;
  scheduleTask?: (task: () => void) => void;
  updater?: AutoUpdaterLike;
  version?: string;
  onReleaseInfoChanged?: () => void;
  fetchUpdateFeedRelease?: FetchUpdateFeedRelease;
};

export class AutoUpdateManager {
  private static readonly repository = "vestin-io/Nile";
  private readonly enabled: boolean;
  private readonly logger: AutoUpdateLogger;
  private readonly isPackaged: boolean;
  private readonly platform: NodeJS.Platform;
  private readonly arch: string;
  private readonly runAutoUpdate: RunAutoUpdate;
  private readonly scheduleTask: (task: () => void) => void;
  private readonly updater: AutoUpdaterLike;
  private readonly version: string;
  private readonly onReleaseInfoChanged: () => void;
  private readonly fetchUpdateFeedRelease: FetchUpdateFeedRelease;
  private hasStarted = false;
  private hasScheduledStart = false;
  private listenersBound = false;
  private checkSequence = 0;
  private status: DesktopReleaseStatus = "idle";
  private availableVersion: string | null = null;
  private errorMessage: string | null = null;

  constructor(options: AutoUpdateManagerOptions) {
    this.enabled = options.enabled ?? true;
    this.logger = options.logger;
    this.isPackaged = options.isPackaged ?? false;
    this.platform = options.platform ?? process.platform;
    this.arch = options.arch ?? process.arch;
    this.runAutoUpdate = options.runAutoUpdate ?? updateElectronApp;
    this.scheduleTask = options.scheduleTask ?? ((task) => {
      setTimeout(task, 0);
    });
    this.updater = options.updater ?? autoUpdater;
    this.version = options.version?.trim() || "0.0.0";
    this.onReleaseInfoChanged = options.onReleaseInfoChanged ?? (() => {});
    this.fetchUpdateFeedRelease = options.fetchUpdateFeedRelease ?? fetchElectronUpdateFeedRelease;
  }

  private readUpdateAvailability(): DesktopUpdateAvailability {
    if (!this.enabled) {
      return "unsupported_platform";
    }

    return readDesktopUpdateAvailability(this.isPackaged, this.version, this.platform);
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

  async checkForUpdates(): Promise<DesktopUpdateCheckResult> {
    if (this.readUpdateAvailability() !== "available") {
      return { status: "unavailable" };
    }

    if (!this.hasStarted) {
      this.startInBackground();
    }

    if (!this.hasStarted) {
      return { status: "unavailable" };
    }

    const sequence = this.beginChecking();

    try {
      this.updater.checkForUpdates();
      this.logger.info("desktop.auto_update.manual_check_started", {
        platform: this.platform,
        repo: AutoUpdateManager.repository,
      });
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

    await this.reconcileReleaseStateWithFeed(sequence, "downloading");
    return { status: "started" };
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
      if (this.status === "idle" || this.status === "up_to_date" || this.status === "error") {
        this.beginChecking();
      }
    });
    this.updater.on("update-available", () => {
      void this.handleUpdateAvailable();
    });
    this.updater.on("update-not-available", () => {
      void this.handleUpdateNotAvailable();
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

  private beginChecking(): number {
    const sequence = ++this.checkSequence;
    this.updateReleaseState({
      status: "checking",
      availableVersion: this.availableVersion,
      errorMessage: null,
    });
    return sequence;
  }

  private async handleUpdateAvailable(): Promise<void> {
    const sequence = this.checkSequence;
    await this.reconcileReleaseStateWithFeed(sequence, "downloading");
  }

  private async handleUpdateNotAvailable(): Promise<void> {
    const sequence = this.checkSequence;
    await this.reconcileReleaseStateWithFeed(sequence, "up_to_date");
  }

  private async reconcileReleaseStateWithFeed(
    sequence: number,
    fallbackStatus: Extract<DesktopReleaseStatus, "downloading" | "up_to_date"> = "up_to_date",
  ): Promise<void> {
    if (sequence !== this.checkSequence) {
      return;
    }

    try {
      const release = await this.readFeedRelease();
      if (sequence !== this.checkSequence) {
        return;
      }

      if (release && isReleaseVersionNewer(release.version, this.version)) {
        this.applyFeedRelease(release, this.status === "ready" ? "ready" : "downloading");
        if (fallbackStatus === "up_to_date") {
          this.updater.checkForUpdates();
        }
        return;
      }

      if (this.status === "ready") {
        return;
      }

      this.updateReleaseState({
        status: "up_to_date",
        availableVersion: null,
        errorMessage: null,
      });
    } catch (error) {
      if (sequence !== this.checkSequence) {
        return;
      }

      this.logger.warn("desktop.auto_update.feed_reconcile_failed", {
        error: error instanceof Error ? error.message : String(error),
        platform: this.platform,
        repo: AutoUpdateManager.repository,
      });
      if (this.status === "checking") {
        this.updateReleaseState({
          status: "error",
          availableVersion: this.availableVersion,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private applyFeedRelease(
    release: ElectronUpdateFeedRelease,
    status: Extract<DesktopReleaseStatus, "downloading" | "ready">,
  ): void {
    this.updateReleaseState({
      status,
      availableVersion: release.version,
      errorMessage: null,
    });
  }

  private readFeedUrl(): string {
    return buildElectronUpdateFeedUrl(
      AutoUpdateManager.repository,
      this.version,
      this.platform,
      this.arch,
    );
  }

  private async readFeedRelease(): Promise<ElectronUpdateFeedRelease | null> {
    return await this.fetchUpdateFeedRelease(this.readFeedUrl());
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
}
