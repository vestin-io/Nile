import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteDatabase } from "@nile/core/services/database";

import { AgentHomesStore } from "./AgentHomesStore";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("AgentHomesStore", () => {
  it("stores a custom override", () => {
    const { databasePath } = createStorePaths();
    const store = new AgentHomesStore(databasePath);

    const result = store.update("openclaw", "/tmp/openclaw-home");

    expect(result).toEqual({ openclaw: "/tmp/openclaw-home" });
    const database = SqliteDatabase.open(databasePath);
    try {
      expect(database.query<{ agent_id: string; path: string }>("SELECT agent_id, path FROM desktop_agent_homes").all()).toEqual([
        { agent_id: "openclaw", path: "/tmp/openclaw-home" },
      ]);
    } finally {
      database.close();
    }
  });

  it("expands a tilde-prefixed path", () => {
    const { databasePath } = createStorePaths();
    const store = new AgentHomesStore(databasePath);

    const result = store.update("claude", "~/.claude-alt");

    expect(result.claude).toBe(join(process.env.HOME ?? "", ".claude-alt"));
  });

  it("drops overrides when resetting to the default path", () => {
    const { databasePath } = createStorePaths();
    const store = new AgentHomesStore(databasePath);
    store.update("codex", "/tmp/custom-codex");

    const result = store.update("codex", "~/.codex");

    expect(result).toEqual({});
  });

});

function createStorePaths(): { databasePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-agent-homes-"));
  tempDirs.push(dir);
  return {
    databasePath: join(dir, "desktop.sqlite"),
  };
}
