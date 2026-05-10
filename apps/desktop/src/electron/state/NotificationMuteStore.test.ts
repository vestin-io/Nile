import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteDatabase } from "@nile/core/services/database";

import { DesktopNotificationMuteStore } from "./NotificationMuteStore";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopNotificationMuteStore", () => {
  it("defaults to unmuted when no config exists", () => {
    const { databasePath } = createStorePaths();
    const store = new DesktopNotificationMuteStore(databasePath);

    expect(store.read()).toBe(false);
  });

  it("stores muted when notifications are muted", () => {
    const { databasePath } = createStorePaths();
    const store = new DesktopNotificationMuteStore(databasePath);

    expect(store.write(true)).toBe(true);
    expect(store.read()).toBe(true);
    const database = SqliteDatabase.open(databasePath);
    try {
      expect(database.query<{ muted: number }>("SELECT muted FROM desktop_notification_mute").all()).toEqual([{ muted: 1 }]);
    } finally {
      database.close();
    }
  });

  it("drops the config file when restoring the default unmuted state", () => {
    const { databasePath } = createStorePaths();
    const store = new DesktopNotificationMuteStore(databasePath);
    store.write(true);

    expect(store.write(false)).toBe(false);
    expect(store.read()).toBe(false);
  });

  it("treats invalid config shapes as unmuted", () => {
    const { databasePath, legacyPath } = createStorePaths();
    writeFileSync(legacyPath, "[]\n", "utf8");
    const store = new DesktopNotificationMuteStore(databasePath, legacyPath);

    expect(store.read()).toBe(false);
    expect(existsSync(legacyPath)).toBe(false);
  });

  it("treats invalid json as unmuted", () => {
    const { databasePath, legacyPath } = createStorePaths();
    writeFileSync(legacyPath, "{ invalid }\n", "utf8");
    const store = new DesktopNotificationMuteStore(databasePath, legacyPath);

    expect(store.read()).toBe(false);
    expect(existsSync(legacyPath)).toBe(false);
  });

  it("migrates a muted legacy json file into sqlite", () => {
    const { databasePath, legacyPath } = createStorePaths();
    writeFileSync(legacyPath, JSON.stringify({ muted: true }), "utf8");

    const store = new DesktopNotificationMuteStore(databasePath, legacyPath);

    expect(store.read()).toBe(true);
    expect(existsSync(legacyPath)).toBe(false);
  });
});

function createStorePaths(): { databasePath: string; legacyPath: string } {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-notification-mute-"));
  tempDirs.push(dir);
  return {
    databasePath: join(dir, "desktop.sqlite"),
    legacyPath: join(dir, "notification-mute.json"),
  };
}
