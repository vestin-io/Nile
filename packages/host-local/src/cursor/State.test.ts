import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";

import { CursorStateDbProbe } from "./State";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("CursorStateDbProbe", () => {
  it("reads a Cursor access token from state.vscdb and exposes it as a usage session", () => {
    const dir = mkdtempSync(join(tmpdir(), "nile-cursor-state-db-"));
    tempDirs.push(dir);
    const databasePath = join(dir, "state.vscdb");
    writeStateDatabase(databasePath, CURSOR_ACCESS_TOKEN);

    const probe = new CursorStateDbProbe([
      {
        sourceId: "cursor-local-state",
        sourceLabel: "Cursor",
        locationLabel: "Local session",
        databasePath,
      },
    ]);

    expect(probe.probe()).toEqual([
      {
        sourceId: "cursor-local-state",
        sourceLabel: "Cursor",
        locationLabel: "Local session",
        workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
        sessionToken: `user_01K03K41CNGRCADY5VT0JPH69Y::${CURSOR_ACCESS_TOKEN}`,
      },
    ]);
  });
});

function writeStateDatabase(databasePath: string, accessToken: string): void {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  try {
    db.exec(
      [
        "create table ItemTable (",
        "key text not null,",
        "value text not null",
        ");",
      ].join(" "),
    );
    db.prepare("insert into ItemTable (key, value) values (?, ?)").run("cursorAuth/accessToken", accessToken);
  } finally {
    db.close();
  }
}

const CURSOR_ACCESS_TOKEN = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhdXRoMHx1c2VyXzAxSzAzSzQxQ05HUkNBRFk1VlQwSlBINjlZIiwidHlwZSI6ImFjY2VzcyIsImV4cCI6NDEwMjQ0NDgwMH0.sig";
