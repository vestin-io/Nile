import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SqliteDatabase } from "@nile/core/services/database";
import { afterEach, describe, expect, it } from "vitest";

import { DesktopEnvironmentStorageModeReader } from "./StorageMode";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopEnvironmentStorageModeReader", () => {
  it("prefers the established saved-connection mode over the desktop preference", () => {
    const setup = createDatabase();
    const database = SqliteDatabase.open(setup.databasePath);
    try {
      database.exec(`
        CREATE TABLE accesses (
          credential_storage_backend TEXT
        );
      `);
      database.run(
        "INSERT INTO accesses (credential_storage_backend) VALUES (?)",
        "encrypted_local_storage",
      );
      database.exec(`
        CREATE TABLE desktop_preferences (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          value TEXT NOT NULL
        );
      `);
      database.run(
        "INSERT INTO desktop_preferences (id, value) VALUES (1, ?)",
        JSON.stringify({ credentialStorageMode: "system_secure_storage" }),
      );
    } finally {
      database.close();
    }

    expect(new DesktopEnvironmentStorageModeReader(setup.databasePath).read()).toBe("encrypted_local_storage");
  });

  it("falls back to the desktop preference before the first saved connection exists", () => {
    const setup = createDatabase();
    const database = SqliteDatabase.open(setup.databasePath);
    try {
      database.exec(`
        CREATE TABLE desktop_preferences (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          value TEXT NOT NULL
        );
      `);
      database.run(
        "INSERT INTO desktop_preferences (id, value) VALUES (1, ?)",
        JSON.stringify({ credentialStorageMode: "encrypted_local_storage" }),
      );
    } finally {
      database.close();
    }

    expect(new DesktopEnvironmentStorageModeReader(setup.databasePath).read()).toBe("encrypted_local_storage");
  });

  it("refuses to infer a file-backed mode from mixed saved-connection backends", () => {
    const setup = createDatabase();
    const database = SqliteDatabase.open(setup.databasePath);
    try {
      database.exec(`
        CREATE TABLE accesses (
          credential_storage_backend TEXT
        );
      `);
      database.run(
        "INSERT INTO accesses (credential_storage_backend) VALUES (?)",
        "encrypted_local_storage",
      );
      database.run(
        "INSERT INTO accesses (credential_storage_backend) VALUES (?)",
        "system_secure_storage",
      );
    } finally {
      database.close();
    }

    expect(new DesktopEnvironmentStorageModeReader(setup.databasePath).read()).toBeNull();
  });
});

function createDatabase(): { databasePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-environment-mode-"));
  tempDirs.push(dir);
  return {
    databasePath: join(dir, "switcher.sqlite"),
  };
}
