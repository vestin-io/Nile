import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteDatabase } from "@nile/core/services/database";

import { DesktopMenubarDisplayStore } from "./MenubarDisplayStore";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopMenubarDisplayStore", () => {
  it("defaults to the app entry mode with no selected ticker agents", () => {
    const { databasePath } = createStorePaths();
    const store = new DesktopMenubarDisplayStore(databasePath);

    expect(store.read()).toEqual({
      hasConfiguredTickerAgents: false,
      mode: "app_entry",
      tickerAgentIds: [],
    });
  });

  it("stores ticker mode and selected agents", () => {
    const { databasePath } = createStorePaths();
    const store = new DesktopMenubarDisplayStore(databasePath);

    expect(store.writeMode("ticker")).toEqual({
      hasConfiguredTickerAgents: false,
      mode: "ticker",
      tickerAgentIds: [],
    });
    expect(store.writeTickerAgentIds(["cursor", "codex", "cursor"])).toEqual({
      hasConfiguredTickerAgents: true,
      mode: "ticker",
      tickerAgentIds: ["codex", "cursor"],
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

  it("rewrites ticker agents in supported-agent order", () => {
    const { databasePath } = createStorePaths();
    const store = new DesktopMenubarDisplayStore(databasePath);

    store.writeMode("ticker");
    expect(store.writeTickerAgentIds(["codex"])).toEqual({
      hasConfiguredTickerAgents: true,
      mode: "ticker",
      tickerAgentIds: ["codex"],
    });
    expect(store.writeTickerAgentIds(["cursor", "codex"])).toEqual({
      hasConfiguredTickerAgents: true,
      mode: "ticker",
      tickerAgentIds: ["codex", "cursor"],
    });
    expect(store.writeTickerAgentIds(["cursor"])).toEqual({
      hasConfiguredTickerAgents: true,
      mode: "ticker",
      tickerAgentIds: ["cursor"],
    });
  });

  it("keeps configured ticker agents when restoring the default app entry mode", () => {
    const { databasePath } = createStorePaths();
    const store = new DesktopMenubarDisplayStore(databasePath);
    store.writeMode("ticker");
    store.writeTickerAgentIds(["codex"]);

    expect(store.writeMode("app_entry")).toEqual({
      hasConfiguredTickerAgents: true,
      mode: "app_entry",
      tickerAgentIds: ["codex"],
    });
  });
});

function createStorePaths(): { databasePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-menubar-display-"));
  tempDirs.push(dir);
  return {
    databasePath: join(dir, "desktop.sqlite"),
  };
}
