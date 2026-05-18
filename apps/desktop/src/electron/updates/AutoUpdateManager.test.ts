import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { AutoUpdateManager } from "./AutoUpdateManager";

describe("AutoUpdateManager", () => {
  it("starts packaged macOS builds against the public Electron update service", () => {
    const runAutoUpdate = vi.fn();
    const logger = new StubLogger();
    const manager = new AutoUpdateManager({
      logger,
      isPackaged: true,
      platform: "darwin",
      runAutoUpdate,
      version: "0.1.0",
      updater: new StubUpdater(),
      scheduleTask: (task) => {
        task();
      },
    });

    manager.start();

    expect(runAutoUpdate).toHaveBeenCalledTimes(1);
    expect(runAutoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      notifyUser: false,
      updateSource: {
        type: 0,
        repo: "vestin-io/Nile",
      },
    }));
  });

  it("reports development builds as unavailable for auto updates", async () => {
    const manager = new AutoUpdateManager({
      logger: new StubLogger(),
      isPackaged: false,
      platform: "darwin",
      updater: new StubUpdater(),
    });

    expect(manager.getReleaseInfo()).toEqual({
      version: "0.0.0",
      updateAvailability: "development",
      status: "idle",
      availableVersion: null,
      errorMessage: null,
    });
    await expect(manager.checkForUpdates()).resolves.toEqual({ status: "unavailable" });
  });

  it("reports unsupported platforms separately", () => {
    const manager = new AutoUpdateManager({
      logger: new StubLogger(),
      isPackaged: true,
      platform: "linux",
      version: "0.1.0",
      updater: new StubUpdater(),
    });

    expect(manager.getReleaseInfo()).toEqual({
      version: "0.1.0",
      updateAvailability: "unsupported_platform",
      status: "idle",
      availableVersion: null,
      errorMessage: null,
    });
  });

  it("reconciles manual checks against the update feed before reporting up to date", async () => {
    const updater = new StubUpdater();
    const runAutoUpdate = vi.fn();
    const onReleaseInfoChanged = vi.fn();
    const manager = new AutoUpdateManager({
      logger: new StubLogger(),
      isPackaged: true,
      platform: "darwin",
      arch: "arm64",
      runAutoUpdate: vi.fn(),
      updater,
      version: "0.16.6",
      onReleaseInfoChanged,
      fetchUpdateFeedRelease: async () => ({
        version: "0.16.7",
        name: "Nile Desktop v0.16.7",
        url: "https://github.com/vestin-io/Nile/releases/download/v0.16.7/Nile-0.16.7-arm64-mac.zip",
      }),
    });

    const result = await manager.checkForUpdates();

    expect(result).toEqual({ status: "started" });
    expect(updater.checkForUpdatesCalls).toBe(1);
    expect(manager.getReleaseInfo()).toEqual({
      version: "0.16.6",
      updateAvailability: "available",
      status: "downloading",
      availableVersion: "0.16.7",
      errorMessage: null,
    });
    expect(onReleaseInfoChanged).toHaveBeenCalled();
  });

  it("does not report a newer feed release as up to date when Electron emits update-not-available", async () => {
    const updater = new StubUpdater();
    const manager = new AutoUpdateManager({
      logger: new StubLogger(),
      isPackaged: true,
      platform: "darwin",
      arch: "arm64",
      runAutoUpdate: vi.fn(),
      updater,
      version: "0.16.6",
      fetchUpdateFeedRelease: async () => ({
        version: "0.16.7",
        name: "Nile Desktop v0.16.7",
        url: "https://github.com/vestin-io/Nile/releases/download/v0.16.7/Nile-0.16.7-arm64-mac.zip",
      }),
    });

    await manager.checkForUpdates();
    updater.emit("update-not-available");
    await Promise.resolve();

    expect(manager.getReleaseInfo()).toEqual({
      version: "0.16.6",
      updateAvailability: "available",
      status: "downloading",
      availableVersion: "0.16.7",
      errorMessage: null,
    });
    expect(updater.checkForUpdatesCalls).toBeGreaterThanOrEqual(1);
  });

  it("captures downloaded versions for install UI", async () => {
    const updater = new StubUpdater();
    const manager = new AutoUpdateManager({
      logger: new StubLogger(),
      isPackaged: true,
      platform: "darwin",
      runAutoUpdate: vi.fn(),
      updater,
      version: "0.15.0",
      fetchUpdateFeedRelease: async () => null,
    });

    await manager.checkForUpdates();
    updater.emit("update-downloaded", {}, "", "Nile Desktop v0.15.1", new Date(), "https://example.com/Nile-0.15.1.zip");

    expect(manager.getReleaseInfo()).toEqual({
      version: "0.15.0",
      updateAvailability: "available",
      status: "ready",
      availableVersion: "0.15.1",
      errorMessage: null,
    });
  });

  it("marks up-to-date checks without showing an update target", async () => {
    const updater = new StubUpdater();
    const manager = new AutoUpdateManager({
      logger: new StubLogger(),
      isPackaged: true,
      platform: "darwin",
      runAutoUpdate: vi.fn(),
      updater,
      version: "0.15.0",
      fetchUpdateFeedRelease: async () => null,
    });

    await manager.checkForUpdates();

    expect(manager.getReleaseInfo()).toEqual({
      version: "0.15.0",
      updateAvailability: "available",
      status: "up_to_date",
      availableVersion: null,
      errorMessage: null,
    });
  });

  it("shows downloading while an update is being fetched", async () => {
    const updater = new StubUpdater();
    const manager = new AutoUpdateManager({
      logger: new StubLogger(),
      isPackaged: true,
      platform: "darwin",
      runAutoUpdate: vi.fn(),
      updater,
      version: "0.15.0",
      fetchUpdateFeedRelease: async () => ({
        version: "0.15.1",
        name: "Nile Desktop v0.15.1",
        url: "https://example.com/Nile-0.15.1.zip",
      }),
    });

    await manager.checkForUpdates();
    updater.emit("update-available");
    await Promise.resolve();

    expect(manager.getReleaseInfo()).toEqual({
      version: "0.15.0",
      updateAvailability: "available",
      status: "downloading",
      availableVersion: "0.15.1",
      errorMessage: null,
    });
  });

  it("quits and installs only when an update is ready", async () => {
    const updater = new StubUpdater();
    const manager = new AutoUpdateManager({
      logger: new StubLogger(),
      isPackaged: true,
      platform: "darwin",
      runAutoUpdate: vi.fn(),
      updater,
      version: "0.15.0",
      fetchUpdateFeedRelease: async () => null,
    });

    expect(manager.installUpdate()).toEqual({ status: "unavailable" });

    await manager.checkForUpdates();
    updater.emit("update-downloaded", {}, "", "v0.15.1", new Date(), "https://example.com/Nile-0.15.1.zip");

    expect(manager.installUpdate()).toEqual({ status: "started" });
    expect(updater.quitAndInstallCalls).toBe(1);
  });

  it("surfaces fetch failures in release info", async () => {
    const updater = new StubUpdater();
    const logger = new StubLogger();
    const manager = new AutoUpdateManager({
      logger,
      isPackaged: true,
      platform: "darwin",
      runAutoUpdate: vi.fn(),
      updater,
      version: "0.15.0",
      fetchUpdateFeedRelease: async () => {
        throw new Error("repository not accessible");
      },
    });

    await manager.checkForUpdates();

    expect(logger.warnEvents).toContainEqual({
      event: "desktop.auto_update.feed_reconcile_failed",
      fields: {
        error: "repository not accessible",
        platform: "darwin",
        repo: "vestin-io/Nile",
      },
    });
    expect(manager.getReleaseInfo()).toEqual({
      version: "0.15.0",
      updateAvailability: "available",
      status: "error",
      availableVersion: null,
      errorMessage: "repository not accessible",
    });
  });
});

class StubUpdater extends EventEmitter {
  checkForUpdatesCalls = 0;
  quitAndInstallCalls = 0;

  checkForUpdates(): void {
    this.checkForUpdatesCalls += 1;
    this.emit("checking-for-update");
  }

  quitAndInstall(): void {
    this.quitAndInstallCalls += 1;
  }
}

class StubLogger {
  readonly debugEvents: Array<{ event: string; fields: Record<string, unknown> }> = [];
  readonly infoEvents: Array<{ event: string; fields: Record<string, unknown> }> = [];
  readonly warnEvents: Array<{ event: string; fields: Record<string, unknown> }> = [];

  debug(event: string, fields?: Record<string, unknown>): void {
    this.debugEvents.push({ event, fields: fields ?? {} });
  }

  info(event: string, fields?: Record<string, unknown>): void {
    this.infoEvents.push({ event, fields: fields ?? {} });
  }

  warn(event: string, fields?: Record<string, unknown>): void {
    this.warnEvents.push({ event, fields: fields ?? {} });
  }

  error(event: string, error?: unknown, fields?: Record<string, unknown>): void {
    this.warnEvents.push({
      event,
      fields: {
        ...(fields ?? {}),
        error: error instanceof Error ? error.message : error,
      },
    });
  }
}
