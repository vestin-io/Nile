import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { CodexAuthStore } from "./CodexAuthStore";

const tempDirs: string[] = [];

describe("CodexAuthStore", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
  });

  it("writes auth.json with owner-only permissions", () => {
    const codexHome = createTempDir();
    const store = new CodexAuthStore({ codexHome });

    store.apply({
      kind: "api_key",
      source: "direct",
      apiKey: "secret",
    });

    const fileMode = statSync(join(codexHome, "auth.json")).mode & 0o777;
    expect(fileMode).toBe(0o600);
  });
});

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-codex-auth-store-"));
  tempDirs.push(dir);
  return dir;
}
