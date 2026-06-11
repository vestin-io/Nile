import { afterEach, describe, expect, it } from "vitest";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "@nile/core/models/access";
import { EndpointRegistry } from "@nile/core/models/endpoint";
import { NileLogger } from "@nile/core/services/NileLogger";
import { NileSession } from "./NileSession";

const tempDirs: string[] = [];
const originalFetch = globalThis.fetch;
const originalPath = process.env.PATH;

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
  globalThis.fetch = originalFetch;
  process.env.PATH = originalPath;
});

describe("RecoveringUsage", () => {
  it("refreshes the current Gemini session and retries quota after an unauthorized saved credential", async () => {
    const setup = createSetup();
    const binDir = join(setup.rootDir, "bin");
    mkdirSync(binDir, { recursive: true });
    writeFakeGeminiRefreshCommand(binDir, {
      accessToken: "fresh-access",
      refreshToken: "fresh-refresh",
      email: "gemini.primary@example.test",
      subject: "google-sub-123",
    });
    process.env.PATH = binDir;

    seedSavedGeminiConnection(setup.dbPath, setup.credentialStore, {
      accessToken: "stale-access",
      refreshToken: "stale-refresh",
      email: "gemini.primary@example.test",
      subject: "google-sub-123",
    });
    seedGeminiLocalSession(setup.geminiHome, {
      accessToken: "stale-local-access",
      refreshToken: "stale-local-refresh",
      email: "gemini.primary@example.test",
      subject: "google-sub-123",
    });

    const authorizationHeaders: string[] = [];
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get("authorization") ?? "";
      authorizationHeaders.push(`${url} ${authorization}`);

      if (url === "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist") {
        if (authorization === "Bearer stale-access") {
          return new Response(null, { status: 401 });
        }
        if (authorization === "Bearer fresh-access") {
          return new Response(JSON.stringify({
            cloudaicompanionProject: "alien-superstate-rq4hk",
          }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
      }

      if (url === "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota") {
        expect(authorization).toBe("Bearer fresh-access");
        return new Response(JSON.stringify({
          buckets: [
            {
              modelId: "gemini-2.5-pro",
              remainingFraction: 0.42,
              resetTime: "2026-05-18T12:00:00.000Z",
            },
          ],
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ url, authorization }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const session = NileSession.open({
      agentHomes: { gemini: setup.geminiHome },
      credentialStore: setup.credentialStore as never,
      databasePath: setup.dbPath,
      logger: NileLogger.silent(),
    });

    try {
      const result = await session.getConnectionUsage("gemini-session");

      expect(result).toEqual({
        connectionId: "gemini-session",
        connectionLabel: "gemini.primary@example.test",
        endpointFamily: "gemini",
        endpointLabel: "Gemini",
        status: "available",
        source: "remote_api",
        planLabel: "Gemini",
        windows: [
          expect.objectContaining({
            label: "Pro",
            remainingPercent: 42,
            usedPercent: 58,
          }),
        ],
      });
    } finally {
      session.close();
    }

    const verificationAccesses = AccessRegistry.open(setup.dbPath, setup.credentialStore);
    try {
      expect(verificationAccesses.readCredential("gemini-session")).toEqual({
        kind: "gemini_cli_session",
        accessToken: "fresh-access",
        refreshToken: "fresh-refresh",
        idToken: createJwt({
          email: "gemini.primary@example.test",
          sub: "google-sub-123",
        }),
        expiryDate: 1800000000000,
      });
    } finally {
      verificationAccesses.close();
    }

    expect(authorizationHeaders).toEqual([
      "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist Bearer stale-access",
      "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist Bearer fresh-access",
      "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota Bearer fresh-access",
    ]);
  });

  it("does not overwrite a saved Gemini connection when the current local session belongs to another identity", async () => {
    const setup = createSetup();
    process.env.PATH = join(setup.rootDir, "empty-bin");
    seedSavedGeminiConnection(setup.dbPath, setup.credentialStore, {
      accessToken: "stale-access",
      refreshToken: "stale-refresh",
      email: "gemini.primary@example.test",
      subject: "google-sub-123",
    });
    seedGeminiLocalSession(setup.geminiHome, {
      accessToken: "other-access",
      refreshToken: "other-refresh",
      email: "gemini.other@example.test",
      subject: "google-sub-999",
    });

    const authorizationHeaders: string[] = [];
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get("authorization") ?? "";
      authorizationHeaders.push(`${url} ${authorization}`);
      return new Response(null, { status: 401 });
    }) as typeof fetch;

    const session = NileSession.open({
      agentHomes: { gemini: setup.geminiHome },
      credentialStore: setup.credentialStore as never,
      databasePath: setup.dbPath,
      logger: NileLogger.silent(),
    });

    try {
      const result = await session.getConnectionUsage("gemini-session");

      expect(result).toMatchObject({
        connectionId: "gemini-session",
        status: "error",
        errorCode: "credential_unauthorized",
        message: "Gemini session is expired or unauthorized. Refresh the Gemini CLI session and try again.",
      });
    } finally {
      session.close();
    }

    const verificationAccesses = AccessRegistry.open(setup.dbPath, setup.credentialStore);
    try {
      expect(verificationAccesses.readCredential("gemini-session")).toEqual({
        kind: "gemini_cli_session",
        accessToken: "stale-access",
        refreshToken: "stale-refresh",
        idToken: createJwt({
          email: "gemini.primary@example.test",
          sub: "google-sub-123",
        }),
        expiryDate: 1700000000000,
      });
    } finally {
      verificationAccesses.close();
    }

    expect(authorizationHeaders).toEqual([
      "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist Bearer stale-access",
    ]);
  });

  it("syncs the current Codex session before attempting login for a same-account saved connection", async () => {
    const setup = createSetup();
    process.env.PATH = join(setup.rootDir, "empty-bin");
    seedSavedOpenAiConnection(setup.dbPath, setup.credentialStore, {
      accessToken: "stale-access",
      refreshToken: "stale-refresh",
      email: "jay.ji@spotto.ai",
      accountId: "acct-123",
    });
    seedCodexLocalSession(setup.codexHome, {
      accessToken: "fresh-access",
      refreshToken: "fresh-refresh",
      email: "jay.ji@spotto.ai",
      accountId: "acct-123",
    });

    const authorizationHeaders: string[] = [];
    globalThis.fetch = (async (_input, init) => {
      const authorization = new Headers(init?.headers).get("authorization") ?? "";
      authorizationHeaders.push(authorization);
      if (authorization === "Bearer stale-access") {
        return new Response(null, { status: 401 });
      }
      if (authorization === "Bearer fresh-access") {
        return new Response(JSON.stringify({
          plan_type: "prolite",
          rate_limit: {
            primary_window: {
              used_percent: 8,
              limit_window_seconds: 18_000,
              reset_at: 1_777_427_411,
            },
          },
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(null, { status: 500 });
    }) as typeof fetch;

    const session = NileSession.open({
      agentHomes: { codex: setup.codexHome },
      credentialStore: setup.credentialStore as never,
      databasePath: setup.dbPath,
      logger: NileLogger.silent(),
    });

    try {
      const result = await session.getConnectionUsage("codex-session", {
        recoverUnauthorizedCurrentSession: true,
      });

      expect(result).toMatchObject({
        connectionId: "codex-session",
        connectionLabel: "jay.ji@spotto.ai",
        endpointFamily: "openai",
        endpointLabel: "OpenAI",
        status: "available",
        source: "remote_api",
        planLabel: "Pro Lite",
      });
    } finally {
      session.close();
    }

    const verificationAccesses = AccessRegistry.open(setup.dbPath, setup.credentialStore);
    try {
      expect(verificationAccesses.readCredential("codex-session")).toEqual(
        openAiSessionCredential("jay.ji@spotto.ai", "fresh-access", "fresh-refresh", "acct-123"),
      );
    } finally {
      verificationAccesses.close();
    }

    expect(authorizationHeaders).toEqual([
      "Bearer stale-access",
      "Bearer fresh-access",
    ]);
  });

  it("does not attempt Codex login when the current Codex session belongs to another identity", async () => {
    const setup = createSetup();
    const markerPath = join(setup.rootDir, "codex-login-attempted");
    const fakeCodex = writeFakeCodexInstall(setup.rootDir, markerPath, {
      accessToken: "recovered-access",
      refreshToken: "recovered-refresh",
      email: "jay.ji@spotto.ai",
      accountId: "acct-123",
    });
    seedSavedOpenAiConnection(setup.dbPath, setup.credentialStore, {
      accessToken: "stale-access",
      refreshToken: "stale-refresh",
      email: "jay.ji@spotto.ai",
      accountId: "acct-123",
    });
    seedCodexLocalSession(setup.codexHome, {
      accessToken: "other-access",
      refreshToken: "other-refresh",
      email: "other@example.test",
      accountId: "acct-999",
    });

    globalThis.fetch = (async () => new Response(null, { status: 401 })) as typeof fetch;

    const session = NileSession.open({
      agentHomes: { codex: setup.codexHome },
      agentRuntimeCommandOverrides: { codex: fakeCodex.vendorPath },
      credentialStore: setup.credentialStore as never,
      databasePath: setup.dbPath,
      logger: NileLogger.silent(),
    });

    try {
      const result = await session.getConnectionUsage("codex-session", {
        recoverUnauthorizedCurrentSession: true,
      });

      expect(result).toMatchObject({
        connectionId: "codex-session",
        status: "error",
        errorCode: "credential_unauthorized",
        message: "OpenAI session is expired or unauthorized. Sign in to Codex again and retry.",
      });
    } finally {
      session.close();
    }

    expect(existsSync(markerPath)).toBe(false);

    const verificationAccesses = AccessRegistry.open(setup.dbPath, setup.credentialStore);
    try {
      expect(verificationAccesses.readCredential("codex-session")).toEqual(
        openAiSessionCredential("jay.ji@spotto.ai", "stale-access", "stale-refresh", "acct-123"),
      );
    } finally {
      verificationAccesses.close();
    }
  });

  it("logs in only after syncing the current Codex session still returns unauthorized", async () => {
    const setup = createSetup();
    const markerPath = join(setup.rootDir, "codex-login-attempted");
    const fakeCodex = writeFakeCodexInstall(setup.rootDir, markerPath, {
      accessToken: "recovered-access",
      refreshToken: "recovered-refresh",
      email: "jay.ji@spotto.ai",
      accountId: "acct-123",
    });
    seedSavedOpenAiConnection(setup.dbPath, setup.credentialStore, {
      accessToken: "stale-access",
      refreshToken: "stale-refresh",
      email: "jay.ji@spotto.ai",
      accountId: "acct-123",
    });
    seedCodexLocalSession(setup.codexHome, {
      accessToken: "fresh-access",
      refreshToken: "fresh-refresh",
      email: "jay.ji@spotto.ai",
      accountId: "acct-123",
    });

    const authorizationHeaders: string[] = [];
    globalThis.fetch = (async (_input, init) => {
      const authorization = new Headers(init?.headers).get("authorization") ?? "";
      authorizationHeaders.push(authorization);
      if (authorization === "Bearer recovered-access") {
        return new Response(JSON.stringify({
          plan_type: "plus",
          rate_limit: {
            primary_window: {
              used_percent: 12,
              limit_window_seconds: 18_000,
              reset_at: 1_777_427_411,
            },
          },
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(null, { status: 401 });
    }) as typeof fetch;

    const session = NileSession.open({
      agentHomes: { codex: setup.codexHome },
      agentRuntimeCommandOverrides: { codex: fakeCodex.vendorPath },
      credentialStore: setup.credentialStore as never,
      databasePath: setup.dbPath,
      logger: NileLogger.silent(),
    });

    try {
      const result = await session.getConnectionUsage("codex-session", {
        recoverUnauthorizedCurrentSession: true,
      });

      expect(result).toMatchObject({
        connectionId: "codex-session",
        status: "available",
        planLabel: "Plus",
      });
    } finally {
      session.close();
    }

    expect(existsSync(markerPath)).toBe(true);

    const verificationAccesses = AccessRegistry.open(setup.dbPath, setup.credentialStore);
    try {
      expect(verificationAccesses.readCredential("codex-session")).toEqual(
        openAiSessionCredential("jay.ji@spotto.ai", "recovered-access", "recovered-refresh", "acct-123"),
      );
    } finally {
      verificationAccesses.close();
    }

    expect(authorizationHeaders).toEqual([
      "Bearer stale-access",
      "Bearer fresh-access",
      "Bearer recovered-access",
    ]);
  });
});

function createSetup() {
  const dir = mkdtempSync(join(tmpdir(), "nile-recovering-usage-"));
  tempDirs.push(dir);
  const codexHome = join(dir, ".codex");
  const geminiHome = join(dir, ".gemini");
  mkdirSync(codexHome, { recursive: true });
  mkdirSync(geminiHome, { recursive: true });
  return {
    codexHome,
    dbPath: join(dir, "switcher.sqlite"),
    geminiHome,
    rootDir: dir,
    credentialStore: new StubCredentialStore(),
  };
}

function seedSavedOpenAiConnection(
  dbPath: string,
  credentialStore: StubCredentialStore,
  input: {
    accessToken: string;
    refreshToken: string;
    email: string;
    accountId: string;
  },
): void {
  const endpointRegistry = EndpointRegistry.open(dbPath);
  endpointRegistry.add({
    id: "openai",
    label: "OpenAI",
    rootUrl: "https://api.openai.com",
    profile: "openai-official",
    protocols: {
      openai: {
        authSchemes: ["bearer"],
        wireApis: ["responses"],
      },
    },
  });
  endpointRegistry.close();

  const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
  accessRegistry.add({
    id: "codex-session",
    endpointId: "openai",
    label: input.email,
    authMode: "openai_session",
    identityKey: `account:${input.accountId}`,
  }, openAiSessionCredential(input.email, input.accessToken, input.refreshToken, input.accountId));
  accessRegistry.close();
}

function seedSavedGeminiConnection(
  dbPath: string,
  credentialStore: StubCredentialStore,
  input: {
    accessToken: string;
    refreshToken: string;
    email: string;
    subject: string;
  },
): void {
  const endpointRegistry = EndpointRegistry.open(dbPath);
  endpointRegistry.add({
    id: "gemini",
    label: "Gemini",
    rootUrl: "https://cloudcode-pa.googleapis.com",
    profile: "gemini-cli",
    protocols: {
      gemini: {
        authTypes: ["oauth-personal"],
      },
    },
  });
  endpointRegistry.close();

  const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
  accessRegistry.add({
    id: "gemini-session",
    endpointId: "gemini",
    label: input.email,
    authMode: "gemini_cli_session",
    identityKey: `google-sub:${input.subject}`,
  }, {
    kind: "gemini_cli_session",
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    idToken: createJwt({ email: input.email, sub: input.subject }),
    expiryDate: 1700000000000,
  });
  accessRegistry.close();
}

function seedGeminiLocalSession(
  geminiHome: string,
  input: {
    accessToken: string;
    refreshToken: string;
    email: string;
    subject: string;
  },
): void {
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
      active: input.email,
      old: [],
    }, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    join(geminiHome, "oauth_creds.json"),
    `${JSON.stringify({
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      id_token: createJwt({ email: input.email, sub: input.subject }),
      expiry_date: 1800000000000,
    }, null, 2)}\n`,
    "utf8",
  );
}

function seedCodexLocalSession(
  codexHome: string,
  input: {
    accessToken: string;
    refreshToken: string;
    email: string;
    accountId: string;
  },
): void {
  writeFileSync(
    join(codexHome, "auth.json"),
    `${JSON.stringify(openAiAuthFile(input.email, input.accessToken, input.refreshToken, input.accountId), null, 2)}\n`,
    "utf8",
  );
}

function createJwt(payload: Record<string, string>): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

function writeFakeGeminiRefreshCommand(
  binDir: string,
  input: {
    accessToken: string;
    refreshToken: string;
    email: string;
    subject: string;
  },
): void {
  const scriptPath = join(binDir, "gemini");
  writeFileSync(
    scriptPath,
    [
      "#!/bin/sh",
      "/bin/cat > \"$GEMINI_CLI_HOME/oauth_creds.json\" <<'EOF'",
      "{",
      `  "access_token": "${input.accessToken}",`,
      `  "refresh_token": "${input.refreshToken}",`,
      `  "id_token": "${createJwt({ email: input.email, sub: input.subject })}",`,
      '  "expiry_date": 1800000000000',
      "}",
      "EOF",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
  chmodSync(scriptPath, 0o755);
}

function writeFakeCodexInstall(
  rootDir: string,
  markerPath: string,
  input: {
    accessToken: string;
    refreshToken: string;
    email: string;
    accountId: string;
  },
): { launcherPath: string; vendorPath: string } {
  const installRoot = join(rootDir, "fake-codex-install");
  const vendorPath = join(installRoot, "vendor", "aarch64-apple-darwin", "bin", "codex");
  const launcherPath = join(installRoot, "codex");
  mkdirSync(join(installRoot, "vendor", "aarch64-apple-darwin", "bin"), { recursive: true });
  writeFileSync(
    vendorPath,
    [
      "#!/bin/sh",
      `/usr/bin/touch ${quoteForShell(markerPath)}`,
      "mkdir -p \"$CODEX_HOME\"",
      "cat > \"$CODEX_HOME/auth.json\" <<'EOF'",
      JSON.stringify(openAiAuthFile(input.email, input.accessToken, input.refreshToken, input.accountId), null, 2),
      "EOF",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
  chmodSync(vendorPath, 0o755);
  writeFileSync(
    launcherPath,
    `#!/bin/sh\nexec ${quoteForShell(vendorPath)} "$@"\n`,
    { mode: 0o755 },
  );
  chmodSync(launcherPath, 0o755);
  return { launcherPath, vendorPath };
}

function openAiAuthFile(
  email: string,
  accessToken: string,
  refreshToken: string,
  accountId: string,
): Record<string, unknown> {
  return {
    OPENAI_API_KEY: null,
    tokens: {
      id_token: createJwt({ email }),
      access_token: accessToken,
      refresh_token: refreshToken,
      account_id: accountId,
    },
    last_refresh: "2026-04-25T00:00:00.000Z",
  };
}

function openAiSessionCredential(
  email: string,
  accessToken: string,
  refreshToken: string,
  accountId: string,
) {
  return {
    kind: "openai_session" as const,
    idToken: createJwt({ email }),
    accessToken,
    refreshToken,
    accountId,
    lastRefresh: "2026-04-25T00:00:00.000Z",
  };
}

function quoteForShell(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

class StubCredentialStore {
  private readonly credentials = new Map<string, unknown>();

  create(id: string, credential: unknown): void {
    this.credentials.set(id, credential);
  }

  update(id: string, credential: unknown): void {
    this.credentials.set(id, credential);
  }

  get(id: string) {
    const credential = this.credentials.get(id);
    if (!credential) {
      throw new Error(`Missing stub credential: ${id}`);
    }
    return credential as never;
  }

  has(id: string): boolean {
    return this.credentials.has(id);
  }

  remove(id: string): void {
    this.credentials.delete(id);
  }
}
