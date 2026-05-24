import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { StoredCredential } from "../../services/credential";
import type { CredentialStore } from "../../services/credential";
import { CredentialStoreCommandError } from "../../services/credential";
import { SqliteDatabase } from "../../services/database";
import { SecureSnapshotStore } from "../../services/history";
import { StateReset } from "./StateReset";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("StateReset", () => {
  it("removes the configured database, sibling history directory, and Nile-managed credentials", () => {
    const root = mkdtempSync(join(tmpdir(), "nile-state-reset-"));
    tempDirs.push(root);
    const databasePath = join(root, "switcher.sqlite");
    const historyPath = join(root, "history");
    const credentialStore = new StubCredentialStore();
    const secureSnapshots = new StubSecureSnapshotStore();

    mkdirSync(dirname(databasePath), { recursive: true });
    mkdirSync(join(historyPath, "mutation-1"), { recursive: true });
    writeFileSync(join(historyPath, "mutation-1", "before.json"), "{}");
    seedResetRefs(databasePath);

    const result = new StateReset(credentialStore, secureSnapshots).reset(databasePath);

    expect(result).toEqual({
      databasePath,
      historyPath,
      credentialsRemoved: true,
      databaseRemoved: true,
      historyRemoved: true,
    });
    expect(existsSync(databasePath)).toBe(false);
    expect(existsSync(historyPath)).toBe(false);
    expect(credentialStore.removedIds).toEqual([
      "access:openai-work",
      "usage:cursor:cursor-work",
    ]);
    expect(secureSnapshots.removedSnapshotRefs).toEqual([
      "mutation-1:secure:0",
    ]);
  });

  it("reports already-empty state when the files do not exist", () => {
    const root = mkdtempSync(join(tmpdir(), "nile-state-reset-empty-"));
    tempDirs.push(root);
    const databasePath = join(root, "switcher.sqlite");

    const result = new StateReset().reset(databasePath);

    expect(result).toEqual({
      databasePath,
      historyPath: join(root, "history"),
      credentialsRemoved: false,
      databaseRemoved: false,
      historyRemoved: false,
    });
  });

  it("does not report credential cleanup when the database has no Nile-managed refs", () => {
    const root = mkdtempSync(join(tmpdir(), "nile-state-reset-no-refs-"));
    tempDirs.push(root);
    const databasePath = join(root, "switcher.sqlite");
    const database = SqliteDatabase.open(databasePath);
    try {
      database.exec(
        "CREATE TABLE accesses (credential_source_ref TEXT NOT NULL, credential_storage_backend TEXT);",
      );
      database.exec("CREATE TABLE cursor_usage_bindings (credential_source_ref TEXT NOT NULL);");
      database.exec(
        "CREATE TABLE mutation_history_files (before_snapshot_kind TEXT NOT NULL, before_snapshot_ref TEXT NOT NULL);",
      );
    } finally {
      database.close();
    }

    const result = new StateReset().reset(databasePath);

    expect(result).toEqual({
      databasePath,
      historyPath: join(root, "history"),
      credentialsRemoved: false,
      databaseRemoved: true,
      historyRemoved: false,
    });
  });

  it("continues resetting local files when credential removal fails unexpectedly", () => {
    const root = mkdtempSync(join(tmpdir(), "nile-state-reset-command-failure-"));
    tempDirs.push(root);
    const databasePath = join(root, "switcher.sqlite");
    const historyPath = join(root, "history");
    const credentialStore = new FailingCredentialStore();

    mkdirSync(dirname(databasePath), { recursive: true });
    mkdirSync(join(historyPath, "mutation-1"), { recursive: true });
    writeFileSync(join(historyPath, "mutation-1", "before.json"), "{}");
    seedResetRefs(databasePath);

    const result = new StateReset(credentialStore).reset(databasePath);

    expect(result).toEqual({
      databasePath,
      historyPath,
      credentialsRemoved: true,
      databaseRemoved: true,
      historyRemoved: true,
    });
    expect(existsSync(databasePath)).toBe(false);
    expect(existsSync(historyPath)).toBe(false);
    expect(credentialStore.removedIds).toEqual([
      "access:openai-work",
      "usage:cursor:cursor-work",
    ]);
  });
});

function seedResetRefs(databasePath: string): void {
  const database = SqliteDatabase.open(databasePath);
  try {
    database.exec(
      "CREATE TABLE accesses (credential_source_ref TEXT NOT NULL, credential_storage_backend TEXT);",
    );
    database.exec("CREATE TABLE cursor_usage_bindings (credential_source_ref TEXT NOT NULL);");
    database.exec(
      "CREATE TABLE mutation_history_files (before_snapshot_kind TEXT NOT NULL, before_snapshot_ref TEXT NOT NULL);",
    );

    database.run(
      "INSERT INTO accesses (credential_source_ref, credential_storage_backend) VALUES (?, ?)",
      "access:openai-work",
      "system_secure_storage",
    );
    database.run(
      "INSERT INTO cursor_usage_bindings (credential_source_ref) VALUES (?)",
      "usage:cursor:cursor-work",
    );
    database.run(
      "INSERT INTO mutation_history_files (before_snapshot_kind, before_snapshot_ref) VALUES (?, ?)",
      "secure",
      "mutation-1:secure:0",
    );
  } finally {
    database.close();
  }
}

class StubCredentialStore implements CredentialStore {
  readonly removedIds: string[] = [];

  create(_credentialId: string, _credential: StoredCredential): void {}

  update(_credentialId: string, _credential: StoredCredential): void {}

  get(_credentialId: string): StoredCredential {
    throw new Error("StateReset tests do not read stored credentials");
  }

  has(_credentialId: string): boolean {
    return false;
  }

  remove(credentialId: string): void {
    this.removedIds.push(credentialId);
  }
}

class FailingCredentialStore extends StubCredentialStore {
  override remove(credentialId: string): void {
    this.removedIds.push(credentialId);
    throw new CredentialStoreCommandError(`Failed to remove credential ${credentialId}: security exited with code 1`);
  }
}

class StubSecureSnapshotStore extends SecureSnapshotStore {
  readonly removedSnapshotRefs: string[] = [];

  override removeSnapshot(snapshotRef: string): void {
    this.removedSnapshotRefs.push(snapshotRef);
  }
}
