import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteDatabase } from "@nile/core/services/database";

import { DesktopProfileFeatureStore } from "./ProfileFeatureStore";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopProfileFeatureStore", () => {
  it("defaults to enabled when no config exists", () => {
    const { databasePath } = createStorePaths();
    const store = new DesktopProfileFeatureStore(databasePath);

    expect(store.read()).toBe(true);
  });

  it("stores disabled when turning profile usage off", () => {
    const { databasePath } = createStorePaths();
    const store = new DesktopProfileFeatureStore(databasePath);

    expect(store.write(false)).toBe(false);
    expect(store.read()).toBe(false);
    const database = SqliteDatabase.open(databasePath);
    try {
      expect(database.query<{ enabled: number }>("SELECT enabled FROM desktop_profile_feature").all()).toEqual([{ enabled: 0 }]);
    } finally {
      database.close();
    }
  });

  it("drops the config file when restoring the default enabled state", () => {
    const { databasePath } = createStorePaths();
    const store = new DesktopProfileFeatureStore(databasePath);
    store.write(false);

    expect(store.write(true)).toBe(true);
    expect(store.read()).toBe(true);
  });

  it("treats invalid config shapes as enabled and removes the legacy file", () => {
    const { databasePath, legacyPath } = createStorePaths();
    writeFileSync(legacyPath, "[]\n", "utf8");
    const store = new DesktopProfileFeatureStore(databasePath, legacyPath);

    expect(store.read()).toBe(true);
    expect(existsSync(legacyPath)).toBe(false);
  });

  it("migrates a disabled legacy config into sqlite", () => {
    const { databasePath, legacyPath } = createStorePaths();
    writeFileSync(legacyPath, JSON.stringify({ enabled: false }), "utf8");

    const store = new DesktopProfileFeatureStore(databasePath, legacyPath);

    expect(store.read()).toBe(false);
    expect(existsSync(legacyPath)).toBe(false);
  });

  it("treats invalid json as enabled and removes the legacy file", () => {
    const { databasePath, legacyPath } = createStorePaths();
    writeFileSync(legacyPath, "{ invalid }\n", "utf8");

    const store = new DesktopProfileFeatureStore(databasePath, legacyPath);

    expect(store.read()).toBe(true);
    expect(existsSync(legacyPath)).toBe(false);
  });
});

function createStorePaths(): { databasePath: string; legacyPath: string } {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-profile-feature-"));
  tempDirs.push(dir);
  return {
    databasePath: join(dir, "desktop.sqlite"),
    legacyPath: join(dir, "profile-feature.json"),
  };
}
