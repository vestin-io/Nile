import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DesktopSecretFileStore } from "./DesktopSecretFileStore";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopSecretFileStore", () => {
  it("restores the previous file when replacing the store file fails", () => {
    const root = mkdtempSync(join(tmpdir(), "nile-desktop-secret-store-"));
    tempDirs.push(root);
    const filePath = join(root, "desktop-environment.json");
    writeFileSync(filePath, `${JSON.stringify({
      version: 1,
      encrypted: false,
      entries: { OPENAI_API_KEY: "old-secret" },
    }, null, 2)}\n`, "utf8");

    let shouldFailFinalRename = true;
    const store = new DesktopSecretFileStore(filePath, {
      existsSync,
      mkdirSync,
      readFileSync,
      unlinkSync,
      writeFileSync,
      renameSync: (from, to) => {
        const fromPath = String(from);
        const toPath = String(to);
        if (shouldFailFinalRename && fromPath.endsWith(".tmp") && toPath === filePath) {
          shouldFailFinalRename = false;
          throw new Error("simulated replace failure");
        }
        renameSync(from, to);
      },
      safeStorage: createSafeStorageStub(),
    });

    expect(() => store.write("OPENAI_API_KEY", "new-secret")).toThrow("simulated replace failure");
    expect(JSON.parse(readFileSync(filePath, "utf8"))).toEqual({
      version: 1,
      encrypted: false,
      entries: { OPENAI_API_KEY: "old-secret" },
    });
  });
});

function createSafeStorageStub() {
  return {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value, "utf8"),
    decryptString: (value: Buffer) => value.toString("utf8"),
  };
}
