import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { EnvironmentSource } from "../../services/EnvironmentSource";
import type { InteractiveSessionLoginRegistry } from "../../session";
import { LocalCredentialResolver } from "./LocalCredentialResolver";

const tempDirs: string[] = [];
const originalPath = process.env.PATH;

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
  currentStubCodexHome = "";
  currentStubClaudeHome = "";
  process.env.PATH = originalPath;
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

  it("can sign in through the shared Codex login helper before reading current auth", async () => {
    const codexHome = createCodexHome();
    const login = new StubCodexSessionLogin();
    currentStubCodexHome = codexHome;
    const resolver = new LocalCredentialResolver(
      { codex: codexHome },
      EnvironmentSource.empty(),
      login,
    );

    await expect(
      resolver.resolveAsync({
        authMode: "openai_session",
        source: "login",
      }),
    ).resolves.toEqual({
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

  it("can sign in through the shared Claude login helper before reading current auth", async () => {
    const claudeHome = createClaudeHome();
    const login = new StubClaudeSessionLogin();
    currentStubClaudeHome = claudeHome;
    const resolver = new LocalCredentialResolver(
      { claude: claudeHome },
      EnvironmentSource.empty(),
      login,
    );

    await expect(
      resolver.resolveAsync({
        authMode: "claude_session",
        source: "login",
      }),
    ).resolves.toEqual({
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

  it("reads the current Gemini CLI session credential", () => {
    const geminiHome = createGeminiHome();
    writeGeminiSessionFiles(geminiHome, "gemini.user@example.com", "gemini-sub-123");
    const resolver = new LocalCredentialResolver(
      { gemini: geminiHome },
      EnvironmentSource.empty(),
    );

    expect(
      resolver.resolve({
        authMode: "gemini_cli_session",
        source: "current_gemini",
      }),
    ).toEqual({
      kind: "gemini_cli_session",
      accessToken: "gemini-access-token",
      refreshToken: "gemini-refresh-token",
      idToken: buildIdToken("gemini.user@example.com", "gemini-sub-123"),
      expiryDate: 1777427411000,
    });
  });

  it("can refresh the current Gemini CLI session before reading it again", async () => {
    const geminiHome = createGeminiHome();
    const root = dirname(geminiHome);
    const binDir = join(root, "bin");
    mkdirSync(binDir, { recursive: true });
    writeGeminiSessionFiles(geminiHome, "gemini.user@example.com", "gemini-sub-123");
    writeFakeGeminiRefreshCommand(binDir, "gemini.user@example.com", "gemini-sub-123");
    const resolver = new LocalCredentialResolver(
      { gemini: geminiHome },
      EnvironmentSource.from({ PATH: binDir, HOME: root }),
    );

    await expect(
      resolver.recoverUnauthorizedCurrentSession({
        authMode: "gemini_cli_session",
        source: "current_gemini",
      }),
    ).resolves.toBe(true);

    expect(
      resolver.resolve({
        authMode: "gemini_cli_session",
        source: "current_gemini",
      }),
    ).toEqual({
      kind: "gemini_cli_session",
      accessToken: "fresh-gemini-access-token",
      refreshToken: "fresh-gemini-refresh-token",
      idToken: buildIdToken("gemini.user@example.com", "gemini-sub-123"),
      expiryDate: 1800000000000,
    });
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

function createGeminiHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-local-credential-resolver-gemini-"));
  tempDirs.push(dir);
  const geminiHome = join(dir, ".gemini");
  mkdirSync(geminiHome, { recursive: true });
  return geminiHome;
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

class StubCodexSessionLogin implements Pick<InteractiveSessionLoginRegistry, "signInAndRead"> {
  readonly calls: string[] = [];

  async signInAndRead(
    _context: unknown,
    _request: unknown,
  ): Promise<{
    kind: "openai_session";
    idToken: string;
    accessToken: string;
    refreshToken: string;
    accountId: string;
    lastRefresh: string;
  }> {
    const codexHome = currentStubCodexHome;
    this.calls.push(codexHome);
    writeOpenAiSession(codexHome, "acct-signed-in");
    return {
      kind: "openai_session",
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accountId: "acct-signed-in",
      lastRefresh: "2026-04-27T00:00:00.000Z",
    };
  }
}

class StubClaudeSessionLogin implements Pick<InteractiveSessionLoginRegistry, "signInAndRead"> {
  readonly calls: string[] = [];

  async signInAndRead(
    _context: unknown,
    _request: unknown,
  ): Promise<{
    kind: "claude_session";
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    accountUuid: string;
    organizationUuid: string;
    email: string;
    displayName: string;
  }> {
    const claudeHome = currentStubClaudeHome;
    this.calls.push(claudeHome);
    writeClaudeSessionFiles(claudeHome);
    return {
      kind: "claude_session",
      accessToken: "claude-access-token",
      refreshToken: "claude-refresh-token",
      expiresAt: 1777427411000,
      accountUuid: "acct-claude-123",
      organizationUuid: "org-claude-456",
      email: "claude@example.com",
      displayName: "Claude User",
    };
  }
}

let currentStubCodexHome = "";
let currentStubClaudeHome = "";

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

function writeGeminiSessionFiles(geminiHome: string, email: string, subject: string): void {
  writeFileSync(
    join(geminiHome, "settings.json"),
    `${JSON.stringify({
      security: {
        auth: {
          selectedType: "oauth-personal",
        },
      },
    }, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    join(geminiHome, "google_accounts.json"),
    `${JSON.stringify({
      active: email,
      old: [],
    }, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    join(geminiHome, "oauth_creds.json"),
    `${JSON.stringify({
      access_token: "gemini-access-token",
      refresh_token: "gemini-refresh-token",
      id_token: buildIdToken(email, subject),
      expiry_date: 1777427411000,
    }, null, 2)}\n`,
    "utf8",
  );
}

function writeFakeGeminiRefreshCommand(binDir: string, email: string, subject: string): void {
  writeFileSync(
    join(binDir, "gemini"),
    [
      "#!/bin/sh",
      "cat > \"$GEMINI_CLI_HOME/oauth_creds.json\" <<'EOF'",
      JSON.stringify({
        access_token: "fresh-gemini-access-token",
        refresh_token: "fresh-gemini-refresh-token",
        id_token: buildIdToken(email, subject),
        expiry_date: 1800000000000,
      }, null, 2),
      "EOF",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
}

function buildIdToken(email: string, subject: string): string {
  return `header.${Buffer.from(JSON.stringify({
    email,
    sub: subject,
  })).toString("base64url")}.signature`;
}
