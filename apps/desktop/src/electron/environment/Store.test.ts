import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SqliteDatabase } from "@nile/core/services/database";

vi.mock("electron", () => ({
  safeStorage: {
    decryptString: (value: Buffer) => value.toString("utf8"),
    encryptString: (value: string) => Buffer.from(value, "utf8"),
    isEncryptionAvailable: () => false,
  },
}));

import {
  DesktopEnvironmentStore,
  readDesktopHelperPathCandidates,
  shouldUseDesktopEnvironmentFileStore,
} from "./Store";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopEnvironmentStore", () => {
  it("checks the workspace core helper before falling back to colocated helper paths", () => {
    const candidates = readDesktopHelperPathCandidates(
      "/Users/jiatwork/Works/nile/apps/desktop/src/electron/environment",
    );

    expect(candidates[0]).toBe(
      join(
        "/Users/jiatwork/Works/nile/apps/desktop/src/electron/environment",
        "..",
        "..",
        "..",
        "..",
        "..",
        "packages",
        "core",
        "dist",
        "services",
        "credential",
        "KeychainGenericPasswordHelper",
      ),
    );
    expect(candidates).toContain(
      join(
        "/Users/jiatwork/Works/nile/apps/desktop/src/electron/environment",
        "KeychainGenericPasswordHelper",
      ),
    );
  });

  it("uses the file-backed environment store on Windows and for encrypted local desktop mode", () => {
    expect(shouldUseDesktopEnvironmentFileStore("win32")).toBe(true);
    expect(shouldUseDesktopEnvironmentFileStore("darwin", "encrypted_local_storage")).toBe(true);
    expect(shouldUseDesktopEnvironmentFileStore("darwin")).toBe(false);
    expect(shouldUseDesktopEnvironmentFileStore("linux")).toBe(false);
  });

  it("stores managed env values in the desktop file store on macOS when encrypted local mode is selected", () => {
    const setup = createDatabase({
      credentialStorageMode: "encrypted_local_storage",
    });
    const writer = {
      read: vi.fn(),
      write: vi.fn(),
      remove: vi.fn(),
    };
    const store = new DesktopEnvironmentStore(setup.databasePath, "nile.test.environment", writer, "darwin");

    store.write("NILE_GATEWAY_TEST_API_KEY", "resolved-secret");

    expect(writer.write).not.toHaveBeenCalled();
    expect(store.read("NILE_GATEWAY_TEST_API_KEY")).toBe("resolved-secret");
  });

  it("re-evaluates the desktop storage mode for the current session instead of caching the startup backend", () => {
    const setup = createDatabase({
      credentialStorageMode: null,
    });
    const writer = {
      read: vi.fn(),
      write: vi.fn(),
      remove: vi.fn(),
    };
    const store = new DesktopEnvironmentStore(setup.databasePath, "nile.test.environment", writer, "darwin");

    writePreferences(setup.databasePath, {
      credentialStorageMode: "encrypted_local_storage",
    });
    store.write("NILE_GATEWAY_TEST_API_KEY", "resolved-secret");

    expect(writer.write).not.toHaveBeenCalled();
    expect(store.read("NILE_GATEWAY_TEST_API_KEY")).toBe("resolved-secret");
  });

  it("invalidates cached environment values when the active backend changes", () => {
    const setup = createDatabase({
      credentialStorageMode: null,
    });
    const writer = {
      read: vi.fn().mockReturnValue({
        exitCode: 0,
        stdout: "system-secret",
        stderr: "",
      }),
      write: vi.fn(),
      remove: vi.fn(),
    };
    const store = new DesktopEnvironmentStore(setup.databasePath, "nile.test.environment", writer, "darwin");

    expect(store.read("NILE_GATEWAY_TEST_API_KEY")).toBe("system-secret");

    writePreferences(setup.databasePath, {
      credentialStorageMode: "encrypted_local_storage",
    });
    store.write("NILE_GATEWAY_TEST_API_KEY", "file-secret");

    expect(store.read("NILE_GATEWAY_TEST_API_KEY")).toBe("file-secret");
  });
});

function createDatabase(
  preferences: { credentialStorageMode: "system_secure_storage" | "encrypted_local_storage" | null },
): { databasePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-environment-store-"));
  tempDirs.push(dir);
  const databasePath = join(dir, "switcher.sqlite");
  const database = SqliteDatabase.open(databasePath);
  try {
    database.exec(`
      CREATE TABLE desktop_preferences (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        value TEXT NOT NULL
      );
    `);
    database.run(
      "INSERT INTO desktop_preferences (id, value) VALUES (1, ?)",
      JSON.stringify(preferences),
    );
  } finally {
    database.close();
  }
  return { databasePath };
}

function writePreferences(
  databasePath: string,
  preferences: { credentialStorageMode: "system_secure_storage" | "encrypted_local_storage" | null },
): void {
  const database = SqliteDatabase.open(databasePath);
  try {
    database.run(
      `
        UPDATE desktop_preferences
        SET value = ?
        WHERE id = 1
      `,
      JSON.stringify(preferences),
    );
  } finally {
    database.close();
  }
}
