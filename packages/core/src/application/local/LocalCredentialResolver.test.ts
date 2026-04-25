import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ClaudeSessionLogin } from "../../agents/claude/ClaudeSessionLogin";
import { CodexSessionLogin } from "../../agents/codex/CodexSessionLogin";
import { EnvironmentSource } from "../../services/EnvironmentSource";
import { LocalCredentialResolver } from "./LocalCredentialResolver";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("LocalCredentialResolver", () => {
  it("normalizes api_key credentials", () => {
    const resolver = new LocalCredentialResolver(undefined, EnvironmentSource.empty());

    expect(
      resolver.resolve({
        authMode: "api_key",
        source: "direct",
        apiKey: "  secret-openai  ",
      }),
    ).toEqual({
      kind: "api_key",
      source: "direct",
      apiKey: "secret-openai",
    });
  });

  it("stores env-key api_key credentials without persisting the secret value", () => {
    const resolver = new LocalCredentialResolver(
      undefined,
      EnvironmentSource.from({ OPENAI_API_KEY_WORK: "secret-openai" }),
    );

    expect(
      resolver.resolve({
        authMode: "api_key",
        source: "env_key",
        envKey: " OPENAI_API_KEY_WORK ",
      }),
    ).toEqual({
      kind: "api_key",
      source: "env_key",
      envKey: "OPENAI_API_KEY_WORK",
    });

    expect(
      resolver.resolveProbeCredential({
        authMode: "api_key",
        source: "env_key",
        envKey: "OPENAI_API_KEY_WORK",
      }),
    ).toEqual({
      kind: "api_key",
      source: "direct",
      apiKey: "secret-openai",
    });
  });

  it("reads the current Codex openai_session credential", () => {
    const codexHome = createCodexHome();
    writeOpenAiSession(codexHome, "acct-current");
    const resolver = new LocalCredentialResolver(
      { codex: codexHome },
      EnvironmentSource.empty(),
    );

    expect(
      resolver.resolve({
        authMode: "openai_session",
        source: "current_codex",
      }),
    ).toEqual({
      kind: "openai_session",
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accountId: "acct-current",
      lastRefresh: "2026-04-27T00:00:00.000Z",
    });
  });

  it("reads the current Codex openai_session credential from a custom auth path", () => {
    const codexHome = createCodexHome();
    const customAuthPath = join(codexHome, "profiles", "work-auth.json");
    mkdirSync(join(codexHome, "profiles"), { recursive: true });
    writeOpenAiSessionAtPath(customAuthPath, "acct-custom");
    const resolver = new LocalCredentialResolver(
      { codex: codexHome },
      EnvironmentSource.empty(),
    );

    expect(
      resolver.resolve({
        authMode: "openai_session",
        authJsonPath: customAuthPath,
        source: "current_codex",
      }),
    ).toEqual({
      kind: "openai_session",
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accountId: "acct-custom",
      lastRefresh: "2026-04-27T00:00:00.000Z",
    });
  });

  it("can sign in through the shared Codex login helper before reading current auth", () => {
    const codexHome = createCodexHome();
    const login = new StubCodexSessionLogin();
    const resolver = new LocalCredentialResolver(
      { codex: codexHome },
      EnvironmentSource.empty(),
      login,
    );

    expect(
      resolver.resolve({
        authMode: "openai_session",
        source: "login",
      }),
    ).toEqual({
      kind: "openai_session",
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accountId: "acct-signed-in",
      lastRefresh: "2026-04-27T00:00:00.000Z",
    });
    expect(login.calls).toEqual([codexHome]);
  });

  it("reads the current Claude session credential", () => {
    const claudeHome = createClaudeHome();
    writeClaudeSessionFiles(claudeHome);
    const resolver = new LocalCredentialResolver(
      { claude: claudeHome },
      EnvironmentSource.empty(),
    );

    expect(
      resolver.resolve({
        authMode: "claude_session",
        source: "current_claude",
      }),
    ).toEqual({
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

  it("can sign in through the shared Claude login helper before reading current auth", () => {
    const claudeHome = createClaudeHome();
    const login = new StubClaudeSessionLogin();
    const resolver = new LocalCredentialResolver(
      { claude: claudeHome },
      EnvironmentSource.empty(),
      new CodexSessionLogin(),
      login,
    );

    expect(
      resolver.resolve({
        authMode: "claude_session",
        source: "login",
      }),
    ).toEqual({
      kind: "claude_session",
      accessToken: "claude-access-token",
      refreshToken: "claude-refresh-token",
      expiresAt: 1777427411000,
      accountUuid: "acct-claude-123",
      organizationUuid: "org-claude-456",
      email: "claude@example.com",
      displayName: "Claude User",
    });
    expect(login.calls).toEqual([claudeHome]);
  });
});

function createCodexHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-local-credential-resolver-"));
  tempDirs.push(dir);
  const codexHome = join(dir, ".codex");
  mkdirSync(codexHome, { recursive: true });
  return codexHome;
}

function createClaudeHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-local-credential-resolver-claude-"));
  tempDirs.push(dir);
  const claudeHome = join(dir, ".claude");
  mkdirSync(claudeHome, { recursive: true });
  return claudeHome;
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

class StubClaudeSessionLogin extends ClaudeSessionLogin {
  readonly calls: string[] = [];

  override signIn(claudeHome: string): void {
    this.calls.push(claudeHome);
    writeClaudeSessionFiles(claudeHome);
  }
}

function writeClaudeSessionFiles(claudeHome: string): void {
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
}
