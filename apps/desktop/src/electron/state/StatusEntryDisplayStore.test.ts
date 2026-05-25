import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { SqliteDatabase } from "@nile/core/services/database";

import { DesktopStatusEntryDisplayStore } from "./StatusEntryDisplayStore";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopStatusEntryDisplayStore", () => {
  it("defaults to the app entry mode with no selected agents", () => {
    const { databasePath } = createStorePaths();
    const store = new DesktopStatusEntryDisplayStore(databasePath);

    expect(store.read()).toEqual({
      hasConfiguredSelectedAgents: false,
      mode: "app_entry",
      selectedAgentIds: [],
    });
  });

  it("stores ticker mode and selected agents", () => {
    const { databasePath } = createStorePaths();
    const store = new DesktopStatusEntryDisplayStore(databasePath);

    expect(store.writeMode("ticker")).toEqual({
      hasConfiguredSelectedAgents: false,
      mode: "ticker",
      selectedAgentIds: [],
    });
    expect(store.writeSelectedAgentIds(["cursor", "codex", "cursor"])).toEqual({
      hasConfiguredSelectedAgents: true,
      mode: "ticker",
      selectedAgentIds: ["codex", "cursor"],
    });

    const database = SqliteDatabase.open(databasePath);
    try {
      expect(database.query<{ mode: string }>("SELECT mode FROM desktop_menubar_display").all()).toEqual([{ mode: "ticker" }]);
      expect(database.query<{ agent_id: string }>("SELECT agent_id FROM desktop_menubar_ticker_agents ORDER BY agent_id").all()).toEqual([
        { agent_id: "codex" },
        { agent_id: "cursor" },
      ]);
    } finally {
      database.close();
    }
  });

  it("rewrites selected agents in supported-agent order", () => {
    const { databasePath } = createStorePaths();
    const store = new DesktopStatusEntryDisplayStore(databasePath);

    store.writeMode("ticker");
    expect(store.writeSelectedAgentIds(["codex"])).toEqual({
      hasConfiguredSelectedAgents: true,
      mode: "ticker",
      selectedAgentIds: ["codex"],
    });
    expect(store.writeSelectedAgentIds(["cursor", "codex"])).toEqual({
      hasConfiguredSelectedAgents: true,
      mode: "ticker",
      selectedAgentIds: ["codex", "cursor"],
    });
    expect(store.writeSelectedAgentIds(["cursor"])).toEqual({
      hasConfiguredSelectedAgents: true,
      mode: "ticker",
      selectedAgentIds: ["cursor"],
    });
  });

  it("keeps configured selected agents when restoring the default app entry mode", () => {
    const { databasePath } = createStorePaths();
    const store = new DesktopStatusEntryDisplayStore(databasePath);
    store.writeMode("ticker");
    store.writeSelectedAgentIds(["codex"]);

    expect(store.writeMode("app_entry")).toEqual({
      hasConfiguredSelectedAgents: true,
      mode: "app_entry",
      selectedAgentIds: ["codex"],
    });
  });
});

function createStorePaths(): { databasePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-status-entry-display-"));
  tempDirs.push(dir);
  return {
    databasePath: join(dir, "desktop.sqlite"),
  };
}
