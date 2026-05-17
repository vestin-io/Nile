import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AgentId } from "../../models/agent/Definitions";
import { SqliteDatabase } from "../database/SqliteDatabase";
import { SqliteMutationHistoryStore } from "./SqliteMutationHistoryStore";
import type { MutationHistoryRecord } from "./MutationHistoryTypes";

const tempRoots: string[] = [];

describe("SqliteMutationHistoryStore", () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      rmSync(tempRoots.pop()!, { recursive: true, force: true });
    }
  });

  test("rolls back the entire insert when writing file rows fails", () => {
    const database = SqliteDatabase.open(createTempDatabasePath());
    const originalRun = database.run.bind(database);
    let fileInsertCount = 0;
    database.run = ((sql: string, ...bindings: string[]) => {
      if (sql.includes("INSERT INTO mutation_history_files")) {
        fileInsertCount += 1;
        if (fileInsertCount === 2) {
          throw new Error("Injected mutation file insert failure");
        }
      }
      return originalRun(sql, ...bindings);
    }) as typeof database.run;

    const store = new SqliteMutationHistoryStore(database);

    try {
      expect(() => store.insert(createRecord())).toThrow("Injected mutation file insert failure");
      expect(store.list(20)).toEqual([]);
    } finally {
      database.close();
    }
  });

  test("creates indexes for history listing and rollback lookups", () => {
    const database = SqliteDatabase.open(createTempDatabasePath());
    try {
      new SqliteMutationHistoryStore(database);
      const indexes = database
        .query<{ name: string }, []>("PRAGMA index_list(mutation_history)")
        .all()
        .map((row) => row.name);

      expect(indexes).toEqual(expect.arrayContaining([
        "idx_mutation_history_started_at_id",
        "idx_mutation_history_latest_apply",
        "idx_mutation_history_rollback_lookup",
      ]));
    } finally {
      database.close();
    }
  });
});

function createTempDatabasePath(): string {
  const root = mkdtempSync(join(tmpdir(), "nile-mutation-store-"));
  tempRoots.push(root);
  return join(root, "switcher.sqlite");
}

function createRecord(): MutationHistoryRecord {
  return {
    id: "mutation-1",
    agentId: "codex" as AgentId,
    type: "apply_selection",
    connectionId: "openai-work",
    connectionLabel: "OpenAI Work",
    endpointLabel: "OpenAI",
    accessLabel: "Work Session",
    status: "started",
    rollbackOfMutationId: null,
    startedAt: "2026-04-29T00:00:00.000Z",
    completedAt: null,
    errorMessage: null,
    files: [
      {
        path: "/tmp/auth.json",
        beforeSnapshotKind: "secure",
        beforeSnapshotRef: "snapshot:auth",
        existedBefore: true,
        beforeChecksum: "a",
        afterChecksum: null,
      },
      {
        path: "/tmp/config.toml",
        beforeSnapshotKind: "file",
        beforeSnapshotRef: "snapshot:config",
        existedBefore: true,
        beforeChecksum: "b",
        afterChecksum: null,
      },
    ],
  };
}
