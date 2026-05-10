import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

  it("migrates legacy json homes into sqlite", () => {
    const { databasePath, legacyPath } = createStorePaths();
    writeFileSync(legacyPath, JSON.stringify({ codex: "/tmp/codex-home" }), "utf8");

    const store = new AgentHomesStore(databasePath, legacyPath);

    expect(store.read()).toEqual({ codex: "/tmp/codex-home" });
    expect(existsSync(legacyPath)).toBe(false);
  });

  it("treats malformed legacy content as empty homes", () => {
    const { databasePath, legacyPath } = createStorePaths();
    writeFileSync(legacyPath, "SQLite format 3", "utf8");

    const store = new AgentHomesStore(databasePath, legacyPath);

    expect(store.read()).toEqual({});
    expect(existsSync(legacyPath)).toBe(false);
  });
});

function createStorePaths(): { databasePath: string; legacyPath: string } {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-agent-homes-"));
  tempDirs.push(dir);
  return {
    databasePath: join(dir, "desktop.sqlite"),
    legacyPath: join(dir, "agent-homes.json"),
  };
}
