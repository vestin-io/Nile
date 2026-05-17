import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ClaudeCredentialStore } from "./Store";

const tempDirs: string[] = [];

describe("ClaudeCredentialStore", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
  });

  it("writes .credentials.json with owner-only permissions", () => {
    const claudeHome = createTempDir();
    const store = new ClaudeCredentialStore(claudeHome);

    store.applyOauth({
      accessToken: "token",
    });

    const fileMode = statSync(join(claudeHome, ".credentials.json")).mode & 0o777;
    expect(fileMode).toBe(0o600);
  });
});

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-claude-credential-store-"));
  tempDirs.push(dir);
  return dir;
}
