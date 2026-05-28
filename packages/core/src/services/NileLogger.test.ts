import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { BoundedLogDestination } from "./BoundedLogDestination";
import { NileLogger } from "./NileLogger";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("NileLogger", () => {
  it("truncates oversized log files and removes stale rotated logs", () => {
    const directory = mkdtempSync(join(tmpdir(), "nile-logger-"));
    tempDirs.push(directory);
    const logPath = join(directory, "app.log");
    const rotatedPath = join(directory, "app.log.1");
    writeFileSync(logPath, Buffer.alloc(10 * 1024 * 1024 + 1, "a"));
    writeFileSync(rotatedPath, "stale");

    NileLogger.createDefault({ logPath, level: "silent" });

    expect(statSync(logPath).size).toBe(0);
    expect(readdirSync(directory)).toEqual(["app.log"]);
  });

  it("keeps the active log bounded while writing", async () => {
    const directory = mkdtempSync(join(tmpdir(), "nile-logger-"));
    tempDirs.push(directory);
    const logPath = join(directory, "app.log");
    const destination = new BoundedLogDestination({
      path: logPath,
      maxBytes: 32,
    });

    await writeChunk(destination, "a".repeat(20));
    await writeChunk(destination, "b".repeat(20));
    await closeDestination(destination);

    expect(statSync(logPath).size).toBe(20);
  });
});

async function writeChunk(destination: BoundedLogDestination, chunk: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    destination.write(chunk, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function closeDestination(destination: BoundedLogDestination): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    destination.end((error?: Error | null) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
