import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { SqliteDatabase } from "@nile/core/services/database";

import { DesktopStateSnapshotStore } from "./SnapshotStore";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopStateSnapshotStore", () => {
  it("skips rewriting unchanged snapshot payloads", async () => {
    const databasePath = createDatabasePath();
    const store = new DesktopStateSnapshotStore(databasePath);
    const state = { agents: [] };

    store.writeStatusEntryState(state);
    const firstUpdatedAt = readUpdatedAt(databasePath, "menubar_state");

    await waitForNextSecond();
    store.writeStatusEntryState(state);
    const secondUpdatedAt = readUpdatedAt(databasePath, "menubar_state");

    expect(secondUpdatedAt).toBe(firstUpdatedAt);
  });
});

function createDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-snapshot-store-"));
  tempDirs.push(dir);
  return join(dir, "desktop.sqlite");
}

function readUpdatedAt(databasePath: string, key: string): string {
  const database = SqliteDatabase.open(databasePath);
  try {
    const row = database.query<{ updated_at: string }>(
      "SELECT updated_at FROM desktop_state_snapshots WHERE snapshot_key = ?",
    ).get(key);
    if (!row) {
      throw new Error(`Missing snapshot row for ${key}`);
    }
    return row.updated_at;
  } finally {
    database.close();
  }
}

async function waitForNextSecond(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 1_100);
  });
}
