import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { SqliteDatabase } from "./SqliteDatabase";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("SqliteDatabase", () => {
  it("rejects async transaction callbacks at runtime", async () => {
    const database = openDatabase();
    try {
      database.exec("CREATE TABLE entries (value TEXT NOT NULL);");

      expect(() =>
        database.transaction((async () => {
          database.run("INSERT INTO entries (value) VALUES (?)", "hello");
        }) as never)
      ).toThrow("SqliteDatabase.transaction() does not support async callbacks");

      const rows = database.query<{ value: string }>("SELECT value FROM entries").all();
      expect(rows).toEqual([]);
    } finally {
      database.close();
    }
  });
});

function openDatabase(): SqliteDatabase {
  const dir = mkdtempSync(join(tmpdir(), "nile-sqlite-database-"));
  tempDirs.push(dir);
  return SqliteDatabase.open(join(dir, "db.sqlite"));
}
