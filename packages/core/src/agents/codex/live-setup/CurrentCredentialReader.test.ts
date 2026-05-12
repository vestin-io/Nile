import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { CodexCurrentCredentialReader } from "./CurrentCredentialReader";
import { CodexSessionLogin } from "../CodexSessionLogin";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("CodexCurrentCredentialReader", () => {
  it("reads the current Codex auth credential from auth.json", () => {
    const codexHome = createCodexHome();
    writeOpenAiSession(codexHome, "acct-current");

    expect(CodexCurrentCredentialReader.open({ codexHome }).read()).toEqual({
      kind: "openai_session",
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accountId: "acct-current",
      lastRefresh: "2026-04-27T00:00:00.000Z",
    });
  });

  it("reads the current Codex auth credential from a custom auth.json path", () => {
    const codexHome = createCodexHome();
    const authPath = join(codexHome, "profiles", "custom-auth.json");
    mkdirSync(join(codexHome, "profiles"), { recursive: true });
    writeOpenAiSessionAtPath(authPath, "acct-custom");

    expect(CodexCurrentCredentialReader.open({ authPath }).read()).toEqual({
      kind: "openai_session",
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accountId: "acct-custom",
      lastRefresh: "2026-04-27T00:00:00.000Z",
    });
  });

  it("lets the shared login helper sign in before reading the current credential", () => {
    const codexHome = createCodexHome();
    const login = new StubCodexSessionLogin();

    expect(login.signInAndRead(codexHome)).toEqual({
      kind: "openai_session",
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accountId: "acct-signed-in",
      lastRefresh: "2026-04-27T00:00:00.000Z",
    });
    expect(login.calls).toEqual([codexHome]);
  });
});

function createCodexHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-codex-current-credential-"));
  tempDirs.push(dir);
  const codexHome = join(dir, ".codex");
  mkdirSync(codexHome, { recursive: true });
  return codexHome;
}

function writeOpenAiSession(codexHome: string, accountId: string): void {
  writeOpenAiSessionAtPath(join(codexHome, "auth.json"), accountId);
}

function writeOpenAiSessionAtPath(authPath: string, accountId: string): void {
  writeFileSync(
    authPath,
    `${JSON.stringify({
      OPENAI_API_KEY: null,
      tokens: {
        id_token: "id-token",
        access_token: "access-token",
        refresh_token: "refresh-token",
        account_id: accountId,
      },
      last_refresh: "2026-04-27T00:00:00.000Z",
    }, null, 2)}\n`,
    "utf8",
  );
}

class StubCodexSessionLogin extends CodexSessionLogin {
  readonly calls: string[] = [];

  override signIn(codexHome: string): void {
    this.calls.push(codexHome);
    writeOpenAiSession(codexHome, "acct-signed-in");
  }
}
