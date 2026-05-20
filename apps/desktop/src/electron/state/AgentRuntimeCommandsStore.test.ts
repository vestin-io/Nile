import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteDatabase } from "@nile/core/services/database";

import { AgentRuntimeCommandsStore } from "./AgentRuntimeCommandsStore";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("AgentRuntimeCommandsStore", () => {
  it("stores a custom command override", () => {
    const { databasePath } = createStorePaths();
    const store = new AgentRuntimeCommandsStore(databasePath);

    const result = store.update("codex", "/tmp/codex-bin/codex");

    expect(result).toEqual({ codex: "/tmp/codex-bin/codex" });
    const database = SqliteDatabase.open(databasePath);
    try {
      expect(database.query<{ agent_id: string; command_path: string }>("SELECT agent_id, command_path FROM desktop_agent_runtime_commands").all()).toEqual([
        { agent_id: "codex", command_path: "/tmp/codex-bin/codex" },
      ]);
    } finally {
      database.close();
    }
  });

  it("expands a tilde-prefixed path", () => {
    const { databasePath } = createStorePaths();
    const store = new AgentRuntimeCommandsStore(databasePath);

    const result = store.update("codex", "~/bin/codex");

    expect(result.codex).toBe(join(process.env.HOME ?? "", "bin", "codex"));
  });

  it("drops overrides when cleared", () => {
    const { databasePath } = createStorePaths();
    const store = new AgentRuntimeCommandsStore(databasePath);
    store.update("codex", "/tmp/custom-codex");

    const result = store.update("codex", null);

    expect(result).toEqual({});
  });
});

function createStorePaths(): { databasePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-agent-runtime-commands-"));
  tempDirs.push(dir);
  return {
    databasePath: join(dir, "desktop.sqlite"),
  };
}
