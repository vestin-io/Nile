import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DesktopPreferencesStore } from "./DesktopPreferencesStore";

describe("DesktopPreferencesStore", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        rmSync(tempDir, { force: true, recursive: true });
      }
    }
  });

  it("reads default preferences when unset", () => {
    const store = new DesktopPreferencesStore(createDatabasePath(tempDirs));

    expect(store.read()).toMatchObject({
      language: "en",
      theme: "system",
      quickSetupDismissed: false,
    });
  });

  it("writes normalized preferences", () => {
    const store = new DesktopPreferencesStore(createDatabasePath(tempDirs));

    const next = store.write({
      agentOrder: ["codex", "claude", "openclaw", "cursor"],
      credentialStorageMode: "encrypted_local_storage",
      connectionQuotaMetricPreferences: { " codex-work ": " weekly " },
      language: "zh",
      quickSetupDismissed: true,
      theme: "dark",
    });

    expect(next).toMatchObject({
      credentialStorageMode: "encrypted_local_storage",
      connectionQuotaMetricPreferences: { "codex-work": "weekly" },
      language: "zh",
      quickSetupDismissed: true,
      theme: "dark",
    });
    expect(store.read()).toEqual(next);
  });

  it("migrates legacy local preferences only when the main store is empty", () => {
    const store = new DesktopPreferencesStore(createDatabasePath(tempDirs));

    const migrated = store.migrateLegacy(JSON.stringify({
      language: "ja",
      theme: "light",
    }));

    expect(migrated).toMatchObject({
      language: "ja",
      theme: "light",
    });

    store.write({
      ...store.read(),
      language: "fr",
    });

    expect(store.migrateLegacy(JSON.stringify({
      language: "de",
    })).language).toBe("fr");
  });
});

function createDatabasePath(tempDirs: string[]): string {
  const directory = mkdtempSync(join(tmpdir(), "nile-desktop-preferences-"));
  tempDirs.push(directory);
  return join(directory, "desktop.sqlite");
}
