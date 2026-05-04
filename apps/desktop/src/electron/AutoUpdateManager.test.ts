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

  it("reports development builds as unavailable for auto updates", () => {
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
    });
    expect(manager.checkForUpdates()).toEqual({ status: "unavailable" });
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
    });
  });

  it("moves to checking state and triggers renderer refresh on manual checks", () => {
    const updater = new StubUpdater();
    const runAutoUpdate = vi.fn();
    const onReleaseInfoChanged = vi.fn();
    const manager = new AutoUpdateManager({
      logger: new StubLogger(),
      isPackaged: true,
      platform: "darwin",
      runAutoUpdate,
      updater,
      version: "0.1.0",
      onReleaseInfoChanged,
    });

    const result = manager.checkForUpdates();

    expect(result).toEqual({ status: "started" });
    expect(updater.checkForUpdatesCalls).toBe(1);
    expect(manager.getReleaseInfo()).toEqual({
      version: "0.1.0",
      updateAvailability: "available",
      status: "checking",
      availableVersion: null,
    });
    expect(onReleaseInfoChanged).toHaveBeenCalled();
  });

  it("captures downloaded versions for install UI", () => {
    const updater = new StubUpdater();
    const manager = new AutoUpdateManager({
      logger: new StubLogger(),
      isPackaged: true,
      platform: "darwin",
      updater,
      version: "0.15.0",
    });

    manager.checkForUpdates();
    updater.emit("update-downloaded", {}, "", "Nile Desktop v0.15.1", new Date(), "https://example.com/Nile-0.15.1.zip");

    expect(manager.getReleaseInfo()).toEqual({
      version: "0.15.0",
      updateAvailability: "available",
      status: "ready",
      availableVersion: "0.15.1",
    });
  });

  it("marks no-update checks without showing an update target", () => {
    const updater = new StubUpdater();
    const manager = new AutoUpdateManager({
      logger: new StubLogger(),
      isPackaged: true,
      platform: "darwin",
      updater,
      version: "0.15.0",
    });

    manager.checkForUpdates();
    updater.emit("update-not-available");

    expect(manager.getReleaseInfo()).toEqual({
      version: "0.15.0",
      updateAvailability: "available",
      status: "no_update",
      availableVersion: null,
    });
  });

  it("quits and installs only when an update is ready", () => {
    const updater = new StubUpdater();
    const manager = new AutoUpdateManager({
      logger: new StubLogger(),
      isPackaged: true,
      platform: "darwin",
      updater,
      version: "0.15.0",
    });

    expect(manager.installUpdate()).toEqual({ status: "unavailable" });

    manager.checkForUpdates();
    updater.emit("update-downloaded", {}, "", "v0.15.1", new Date(), "https://example.com/Nile-0.15.1.zip");

    expect(manager.installUpdate()).toEqual({ status: "started" });
    expect(updater.quitAndInstallCalls).toBe(1);
  });

  it("downgrades fetch failures to warnings without blocking use", () => {
    const updater = new StubUpdater();
    const logger = new StubLogger();
    const manager = new AutoUpdateManager({
      logger,
      isPackaged: true,
      platform: "darwin",
      updater,
      version: "0.15.0",
    });

    manager.checkForUpdates();
    updater.emit("error", new Error("repository not accessible"));

    expect(logger.warnEvents).toContainEqual({
      event: "desktop.auto_update.fetch_failed",
      fields: {
        error: "repository not accessible",
        platform: "darwin",
        repo: "vestin-io/Nile",
      },
    });
    expect(manager.getReleaseInfo().status).toBe("idle");
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
