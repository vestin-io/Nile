import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { CurrentCredentialReader } from "./CredentialReader";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("ClaudeCurrentCredentialReader", () => {
  it("reads the current Claude session credential from live files", () => {
    const claudeHome = createClaudeHome();
    writeFileSync(
      join(claudeHome, ".credentials.json"),
      `${JSON.stringify({
        claudeAiOauth: {
          accessToken: "claude-access-token",
          refreshToken: "claude-refresh-token",
          expiresAt: 1777427411000,
        },
      }, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      join(claudeHome, "settings.json"),
      `${JSON.stringify({
        oauthAccount: {
          emailAddress: "claude@example.com",
          accountUuid: "acct-claude-123",
          organizationUuid: "org-claude-456",
          displayName: "Claude User",
        },
      }, null, 2)}\n`,
      "utf8",
    );

    expect(CurrentCredentialReader.open({ claudeHome }).read()).toEqual({
      kind: "claude_session",
      accessToken: "claude-access-token",
      refreshToken: "claude-refresh-token",
      expiresAt: 1777427411000,
      accountUuid: "acct-claude-123",
      organizationUuid: "org-claude-456",
      email: "claude@example.com",
      displayName: "Claude User",
    });
  });
});

function createClaudeHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-claude-current-credential-"));
  tempDirs.push(dir);
  const claudeHome = join(dir, ".claude");
  mkdirSync(claudeHome, { recursive: true });
  return claudeHome;
}
