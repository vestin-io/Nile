import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

export class CopiedSqliteDatabase {
  static readValue(databasePath: string, query: string, params: SQLInputValue[] = []): string | null {
    if (!existsSync(databasePath)) {
      return null;
    }

    try {
      return this.readFromPath(databasePath, query, params);
    } catch {
      return this.readFromCopiedPath(databasePath, query, params);
    }
  }

  private static readFromPath(databasePath: string, query: string, params: SQLInputValue[]): string | null {
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const row = database.prepare(query).get(...params) as { value?: unknown } | undefined;
      const value = row?.value;
      return typeof value === "string" && value.trim() ? value.trim() : null;
    } finally {
      database.close();
    }
  }

  private static readFromCopiedPath(databasePath: string, query: string, params: SQLInputValue[]): string | null {
    const tempDir = mkdtempSync(join(tmpdir(), "nile-host-local-sqlite-"));
    const tempDbPath = join(tempDir, basename(databasePath));
    this.copyIfExists(databasePath, tempDbPath);
    this.copyIfExists(`${databasePath}-wal`, `${tempDbPath}-wal`);
    this.copyIfExists(`${databasePath}-shm`, `${tempDbPath}-shm`);

    try {
      const database = new DatabaseSync(tempDbPath, { readOnly: true });
      try {
        const row = database.prepare(query).get(...params) as { value?: unknown } | undefined;
        const value = row?.value;
        return typeof value === "string" && value.trim() ? value.trim() : null;
      } finally {
        database.close();
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private static copyIfExists(sourcePath: string, targetPath: string): void {
    if (existsSync(sourcePath)) {
      copyFileSync(sourcePath, targetPath);
    }
  }
}
