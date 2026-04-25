import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ClaudeSessionLogin, CodexSessionLogin } from "@nile/core/agents";
import { AccessRegistry } from "@nile/core/models/access";
import { EndpointRegistry } from "@nile/core/models/endpoint";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { KeychainCredentialStore, type StoredCredential } from "@nile/core/services/credential";

import { DesktopConnectionManager } from "./DesktopConnectionManager";

const tempDirs: string[] = [];
const originalFetch = globalThis.fetch;

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
  globalThis.fetch = originalFetch;
});

describe("DesktopConnectionManager", () => {
  it("reuses matching connections through ConnectionCreator", async () => {
    const setup = createSetup();
    stubGatewayProbe();
    const manager = new DesktopConnectionManager({
      databasePath: setup.dbPath,
      agentHomes: { codex: setup.codexHome },
      environment: EnvironmentSource.empty(),
      credentialStore: setup.credentialStore,
    });

    const first = await manager.addConnection({
      preset: "gateway",
      authMode: "api_key",
      endpointUrl: "https://router.example/v1",
      apiKey: "router-secret",
    });
    const second = await manager.addConnection({
      preset: "gateway",
      authMode: "api_key",
      endpointUrl: "https://router.example/v1",
      apiKey: "router-secret",
    });

    expect(first).toEqual(
      expect.objectContaining({
        id: "gateway-router-example-api-key",
        label: "Gateway (router.example) API Key",
        endpointId: "gateway-router-example",
        endpointLabel: "Gateway (router.example)",
        authMode: "api_key",
      }),
    );
    expect(second).toEqual({
      ...first,
      reused: true,
    });

    const accessRegistry = AccessRegistry.open(setup.dbPath, setup.credentialStore);
    try {
      expect(accessRegistry.list()).toHaveLength(1);
    } finally {
      accessRegistry.close();
    }
  });

  it("adds an openai_session connection from the current Codex auth", async () => {
    const setup = createSetup();
    writeOpenAiSession(setup.codexHome, "acct-current");

    const manager = new DesktopConnectionManager({
      databasePath: setup.dbPath,
      agentHomes: { codex: setup.codexHome },
      environment: EnvironmentSource.empty(),
      credentialStore: setup.credentialStore,
    });

    const result = await manager.addConnection({
      preset: "openai",
      authMode: "openai_session",
      openAiSessionSource: "current_codex",
    });

    expect(result).toEqual(
      expect.objectContaining({
        endpointId: "openai",
        endpointFamily: "openai",
        authMode: "openai_session",
      }),
    );
  });

  it("adds an openai_session connection from a custom Codex auth.json path", async () => {
    const setup = createSetup();
    const authPath = join(setup.codexHome, "profiles", "custom-auth.json");
    mkdirSync(join(setup.codexHome, "profiles"), { recursive: true });
    writeOpenAiSessionAtPath(authPath, "acct-custom");

    const manager = new DesktopConnectionManager({
      databasePath: setup.dbPath,
      agentHomes: { codex: setup.codexHome },
      environment: EnvironmentSource.empty(),
      credentialStore: setup.credentialStore,
    });

    const result = await manager.addConnection({
      preset: "openai",
      authMode: "openai_session",
      openAiSessionSource: "current_codex",
      openAiAuthJsonPath: authPath,
    });

    expect(result).toEqual(
      expect.objectContaining({
        endpointId: "openai",
        endpointFamily: "openai",
        authMode: "openai_session",
      }),
    );
  });

  it("uses the shared core login helper when desktop onboarding requests a sign-in", async () => {
    const setup = createSetup();
    const loginRunner = new StubCodexSessionLogin();
    const manager = new DesktopConnectionManager(
      {
        databasePath: setup.dbPath,
        agentHomes: { codex: setup.codexHome },
        environment: EnvironmentSource.empty(),
        credentialStore: setup.credentialStore,
      },
      loginRunner,
    );

    const result = await manager.addConnection({
      preset: "openai",
      authMode: "openai_session",
      openAiSessionSource: "login",
    });

    expect(loginRunner.signInCalls).toEqual([setup.codexHome]);
    expect(result).toEqual(
      expect.objectContaining({
        endpointId: "openai",
        endpointFamily: "openai",
        authMode: "openai_session",
      }),
    );
  });

  it("adds a claude_session connection from the current Claude auth", async () => {
    const setup = createSetup();
    writeClaudeSession(setup.claudeHome);

    const manager = new DesktopConnectionManager({
      databasePath: setup.dbPath,
      agentHomes: { claude: setup.claudeHome },
      environment: EnvironmentSource.empty(),
      credentialStore: setup.credentialStore,
    });

    const result = await manager.addConnection({
      preset: "anthropic",
      authMode: "claude_session",
    });

    expect(result).toEqual(
      expect.objectContaining({
        endpointId: "claude",
        endpointFamily: "anthropic",
        authMode: "claude_session",
      }),
    );
  });

  it("allows saving a gateway after capability detection fails when manual fallback is requested", async () => {
    const setup = createSetup();
    globalThis.fetch = (async () =>
      new Response("{}", { status: 404, headers: { "content-type": "application/json" } })) as typeof fetch;

    const manager = new DesktopConnectionManager({
      databasePath: setup.dbPath,
      agentHomes: { codex: setup.codexHome },
      environment: EnvironmentSource.empty(),
      credentialStore: setup.credentialStore,
    });

    const result = await manager.addConnection({
      preset: "gateway",
      authMode: "api_key",
      endpointUrl: "https://router.example/v1",
      apiKey: "router-secret",
      enabledAgents: ["codex"],
      allowUndetectedGateway: true,
    });

    expect(result).toEqual(
      expect.objectContaining({
        endpointId: "gateway-router-example",
        endpointFamily: "gateway",
        authMode: "api_key",
      }),
    );
  });

  it("uses the shared Claude login helper when desktop onboarding requests a sign-in", async () => {
    const setup = createSetup();
    const loginRunner = new StubClaudeSessionLogin();
    const manager = new DesktopConnectionManager(
      {
        databasePath: setup.dbPath,
        agentHomes: { claude: setup.claudeHome },
        environment: EnvironmentSource.empty(),
        credentialStore: setup.credentialStore,
      },
      new CodexSessionLogin(),
      loginRunner,
    );

    const result = await manager.prepareConnectionDraft({
      preset: "anthropic",
      authMode: "claude_session",
      claudeSessionSource: "login",
    });

    expect(loginRunner.signInCalls).toEqual([setup.claudeHome]);
    expect(result.authMode).toBe("claude_session");
    expect(result.labelSuggestion).toBe("claude@example.com");
  });

  it("binds Cursor usage for a saved cursor_session connection", () => {
    const setup = createSetup();
    seedCursorConnection(setup);
    const manager = new DesktopConnectionManager({
      databasePath: setup.dbPath,
      agentHomes: { cursor: setup.cursorHome },
      environment: EnvironmentSource.empty(),
      credentialStore: setup.credentialStore,
    });

    const result = manager.bindCursorUsage("cursor-work", CURSOR_WEB_SESSION_TOKEN);

    expect(result).toEqual(
      expect.objectContaining({
        connectionId: "cursor-work",
        connectionLabel: "Cursor Work",
        endpointLabel: "Cursor",
        endpointFamily: "cursor",
        workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
      }),
    );
  });

  it("re-applies updated connection to selected agents when syncSelectedAgents is enabled", async () => {
    const useCalls: Array<[string, string]> = [];
    const sessionStub = {
      listSavedConnections: () => [{
        id: "shared-connection",
        endpointId: "openai",
        endpointUrl: "https://api.openai.com/v1",
        label: "Shared Connection",
        endpointLabel: "OpenAI",
        endpointFamily: "openai",
        authMode: "api_key",
        enabledAgents: ["codex", "claude"],
        configurableAgents: ["codex", "claude"],
        selectedByAgents: ["codex", "claude"],
      }],
      updateConnection: async () => ({
        id: "shared-connection",
        endpointId: "openai",
        endpointUrl: "https://api.openai.com/v1",
        label: "Shared Connection",
        endpointLabel: "OpenAI",
        endpointFamily: "openai",
        authMode: "api_key",
        enabledAgents: ["codex", "claude"],
        configurableAgents: ["codex", "claude"],
        selectedByAgents: ["codex", "claude"],
      }),
      useConnection: (agentId: string, connectionId: string) => {
        useCalls.push([agentId, connectionId]);
        return {
          agentId,
          connectionId,
          connectionLabel: "Shared Connection",
          endpointId: "openai",
          endpointLabel: "OpenAI",
          appliedAt: "2026-05-03T00:00:00.000Z",
        };
      },
      close: () => {},
    };

    class SessionStubbedDesktopConnectionManager extends DesktopConnectionManager {
      override openSession(): never {
        return sessionStub as never;
      }
    }

    const setup = createSetup();
    const manager = new SessionStubbedDesktopConnectionManager({
      databasePath: setup.dbPath,
      environment: EnvironmentSource.empty(),
      credentialStore: setup.credentialStore,
    });

    await manager.updateConnection({
      connectionId: "shared-connection",
      syncSelectedAgents: true,
    });

    expect(useCalls).toEqual([
      ["codex", "shared-connection"],
      ["claude", "shared-connection"],
    ]);
  });
});

function createSetup(): {
  dbPath: string;
  codexHome: string;
  claudeHome: string;
  cursorHome: string;
  credentialStore: StubCredentialStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-connection-manager-"));
  tempDirs.push(dir);
  const codexHome = join(dir, ".codex");
  const claudeHome = join(dir, ".claude");
  const cursorHome = join(dir, ".cursor");
  mkdirSync(codexHome, { recursive: true });
  mkdirSync(claudeHome, { recursive: true });
  mkdirSync(cursorHome, { recursive: true });

  return {
    dbPath: join(dir, "switcher.sqlite"),
    codexHome,
    claudeHome,
    cursorHome,
    credentialStore: new StubCredentialStore(),
  };
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

function writeClaudeSession(claudeHome: string): void {
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

class StubCredentialStore extends KeychainCredentialStore {
  private readonly credentials = new Map<string, StoredCredential>();

  override create(credentialId: string, credential: StoredCredential): void {
    this.credentials.set(credentialId, credential);
  }

  override update(credentialId: string, credential: StoredCredential): void {
    this.credentials.set(credentialId, credential);
  }

  override get(credentialId: string): StoredCredential {
    const credential = this.credentials.get(credentialId);
    if (!credential) {
      throw new Error(`Missing stub credential: ${credentialId}`);
    }
    return credential;
  }

  override has(credentialId: string): boolean {
    return this.credentials.has(credentialId);
  }

  override remove(credentialId: string): void {
    this.credentials.delete(credentialId);
  }
}

class StubCodexSessionLogin extends CodexSessionLogin {
  readonly signInCalls: string[] = [];

  override signIn(codexHome: string): void {
    this.signInCalls.push(codexHome);
    writeOpenAiSession(codexHome, "acct-signed-in");
  }
}

class StubClaudeSessionLogin extends ClaudeSessionLogin {
  readonly signInCalls: string[] = [];

  override signIn(claudeHome: string): void {
    this.signInCalls.push(claudeHome);
    writeClaudeSession(claudeHome);
  }
}

function stubGatewayProbe(): void {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (
      url.endsWith("/v1/responses")
      || url.endsWith("/v1/chat/completions")
      || url.endsWith("/v1/models")
      || url.endsWith("/v1/messages")
    ) {
      return new Response("{}", { status: 401, headers: { "content-type": "application/json" } });
    }
    return new Response("{}", { status: 404, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

function seedCursorConnection(setup: ReturnType<typeof createSetup>): void {
  const endpointRegistry = EndpointRegistry.open(setup.dbPath);
  const accessRegistry = AccessRegistry.open(setup.dbPath, setup.credentialStore);
  try {
    endpointRegistry.add({
      id: "cursor",
      label: "Cursor",
      rootUrl: "https://cursor.com",
      profile: "cursor-backend",
      protocols: {
        cursor: {},
      },
    });
    accessRegistry.add(
      {
        id: "cursor-work",
        endpointId: "cursor",
        label: "Cursor Work",
        authMode: "cursor_session",
        identityKey: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
        enabledAgents: ["cursor"],
      },
      {
        kind: "cursor_session",
        accessToken: "cursor-access",
        refreshToken: "cursor-refresh",
        authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
        email: "cursor.user@example.com",
      },
    );
  } finally {
    accessRegistry.close();
    endpointRegistry.close();
  }
}

const CURSOR_WEB_SESSION_TOKEN = "user_01K03K41CNGRCADY5VT0JPH69Y::eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhdXRoMHx1c2VyXzAxSzAzSzQxQ05HUkNBRFk1VlQwSlBINjlZIiwidHlwZSI6IndlYiIsImV4cCI6NDEwMjQ0NDgwMH0.sig";
