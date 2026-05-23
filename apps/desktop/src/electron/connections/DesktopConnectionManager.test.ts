import { afterEach, describe, expect, it, vi } from "vitest";
import { createCipheriv, pbkdf2Sync } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";

import { AccessRegistry } from "@nile/core/models/access";
import { EndpointRegistry } from "@nile/core/models/endpoint";
import { CursorUsageBindingRegistry } from "@nile/builtins/cursor-usage";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import type { InteractiveSessionLoginContext } from "@nile/core/session";
import {
  BackendCredentialStore,
  KeychainCredentialStore,
  SecurityCli,
  type StoredCredential,
  type SecurityCliResult,
  SystemSecureCredentialStoreDeniedError,
  normalizeCredentialStoreTarget,
  type CredentialStoreTarget,
} from "@nile/core/services/credential";
import type { InteractiveSessionLoginRegistry } from "@nile/builtins/session";

import { DesktopConnectionGateway } from "./DesktopConnectionGateway";
import { DesktopConnectionManager } from "./DesktopConnectionManager";

const tempDirs: string[] = [];
const originalFetch = globalThis.fetch;
const originalSecurityCliRun = SecurityCli.prototype.run;

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
  globalThis.fetch = originalFetch;
  SecurityCli.prototype.run = originalSecurityCliRun;
  delete process.env.NILE_BROWSER_HOME;
  vi.useRealTimers();
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
      sessionSource: "current_codex",
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
      sessionSource: "current_codex",
      sessionAuthJsonPath: authPath,
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
    const loginRunner = new StubCodexInteractiveSessionLoginRegistry(setup.codexHome);
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
      sessionSource: "login",
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

  it("passes the desktop browser opener into Codex session sign-in", async () => {
    const setup = createSetup();
    const loginRunner = new StubCodexInteractiveSessionLoginRegistry(
      setup.codexHome,
      "https://auth.openai.com/oauth/authorize?state=desktop-test",
    );
    const openExternalUrl = vi.fn(async () => {});
    const manager = new DesktopConnectionManager(
      {
        databasePath: setup.dbPath,
        agentHomes: { codex: setup.codexHome },
        environment: EnvironmentSource.empty(),
        openExternalUrl,
        credentialStore: setup.credentialStore,
      },
      loginRunner,
    );

    const draft = await manager.prepareConnectionDraft({
      preset: "openai",
      authMode: "openai_session",
      sessionSource: "login",
    });

    expect(draft.authMode).toBe("openai_session");
    expect(openExternalUrl).toHaveBeenCalledWith(
      "https://auth.openai.com/oauth/authorize?state=desktop-test",
    );
  });

  it("passes the desktop-local Codex CLI override into session sign-in", async () => {
    const setup = createSetup();
    const loginRunner = new StubCodexInteractiveSessionLoginRegistry(setup.codexHome);
    const manager = new DesktopConnectionManager(
      {
        databasePath: setup.dbPath,
        agentHomes: { codex: setup.codexHome },
        agentRuntimeCommandOverrides: { codex: "/tmp/codex-override/codex" },
        environment: EnvironmentSource.empty(),
        credentialStore: setup.credentialStore,
      },
      loginRunner,
    );

    await manager.prepareConnectionDraft({
      preset: "openai",
      authMode: "openai_session",
      sessionSource: "login",
    });

    expect(loginRunner.commandOverrides).toEqual(["/tmp/codex-override/codex"]);
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
      sessionSource: "current_claude",
    });

    expect(result).toEqual(
      expect.objectContaining({
        endpointId: "claude",
        endpointFamily: "anthropic",
        authMode: "claude_session",
      }),
    );
  });

  it("adds a gemini_cli_session connection from the current Gemini CLI auth", async () => {
    const setup = createSetup();
    writeGeminiSession(setup.geminiHome, "gemini.user@example.com", "gemini-sub-123");

    const manager = new DesktopConnectionManager({
      databasePath: setup.dbPath,
      agentHomes: { gemini: setup.geminiHome },
      environment: EnvironmentSource.empty(),
      credentialStore: setup.credentialStore,
    });

    const result = await manager.addConnection({
      preset: "gemini",
      authMode: "gemini_cli_session",
      sessionSource: "current_gemini",
    });

    expect(result).toEqual(
      expect.objectContaining({
        endpointId: "gemini",
        endpointFamily: "gemini",
        authMode: "gemini_cli_session",
      }),
    );
  });

  it("uses the shared Gemini login helper when desktop onboarding requests a sign-in", async () => {
    const setup = createSetup();
    const loginRunner = new StubGeminiInteractiveSessionLoginRegistry(setup.geminiHome);
    const manager = new DesktopConnectionManager(
      {
        databasePath: setup.dbPath,
        agentHomes: { gemini: setup.geminiHome },
        environment: EnvironmentSource.empty(),
        credentialStore: setup.credentialStore,
      },
      loginRunner,
    );

    const result = await manager.addConnection({
      preset: "gemini",
      authMode: "gemini_cli_session",
      sessionSource: "login",
    });

    expect(loginRunner.signInCalls).toEqual([setup.geminiHome]);
    expect(result).toEqual(
      expect.objectContaining({
        endpointId: "gemini",
        endpointFamily: "gemini",
        authMode: "gemini_cli_session",
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
      endpointUrl: "https://fallback-router.example/v1",
      apiKey: "fallback-router-secret",
      enabledAgents: ["codex"],
      allowUndetectedGateway: true,
    });

    expect(result).toEqual(
      expect.objectContaining({
        endpointId: "gateway-fallback-router-example",
        endpointFamily: "gateway",
        authMode: "api_key",
      }),
    );
  });

  it("surfaces an explicit encrypted-local fallback when system secure storage is denied", async () => {
    const setup = createSetup();
    stubGatewayProbe();

    const manager = new DesktopConnectionManager({
      databasePath: setup.dbPath,
      agentHomes: { codex: setup.codexHome },
      environment: EnvironmentSource.empty(),
      credentialStore: new DenyingCredentialStore(),
    });

    await expect(manager.addConnection({
      preset: "gateway",
      authMode: "api_key",
      endpointUrl: "https://router.example/v1",
      apiKey: "router-secret",
      credentialStorageBackend: "system_secure_storage",
    })).rejects.toThrow(
      "System secure storage was denied by macOS. Choose Encrypted local storage to continue without Keychain.",
    );
  });

  it("does not create an encrypted local vault while only preparing a draft", async () => {
    const setup = createSetup();
    const credentialStore = new BackendCredentialStore(setup.dbPath, new StubCredentialStore());
    stubGatewayProbe();
    const manager = new DesktopConnectionManager({
      databasePath: setup.dbPath,
      agentHomes: { codex: setup.codexHome },
      environment: EnvironmentSource.empty(),
      credentialStore,
      credentialStorageSession: credentialStore,
    });

    await manager.prepareConnectionDraft({
      preset: "gateway",
      authMode: "api_key",
      endpointUrl: "https://router.example/v1",
      apiKey: "router-secret",
      credentialStorageBackend: "encrypted_local_storage",
      encryptedLocalPassphrase: "passphrase-123",
    });

    expect(credentialStore.hasEncryptedLocalVault()).toBe(false);
  });

  it("uses the shared Claude login helper when desktop onboarding requests a sign-in", async () => {
    const setup = createSetup();
    const loginRunner = new StubClaudeInteractiveSessionLoginRegistry(setup.claudeHome);
    const manager = new DesktopConnectionManager(
      {
        databasePath: setup.dbPath,
        agentHomes: { claude: setup.claudeHome },
        environment: EnvironmentSource.empty(),
        credentialStore: setup.credentialStore,
      },
      loginRunner,
    );

    const result = await manager.prepareConnectionDraft({
      preset: "anthropic",
      authMode: "claude_session",
      sessionSource: "login",
    });

    expect(loginRunner.signInCalls).toEqual([setup.claudeHome]);
    expect(result.authMode).toBe("claude_session");
    expect(result.labelSuggestion).toBe("claude@example.com");
  });

  it("discards prepared drafts that are abandoned before save", async () => {
    const setup = createSetup();
    const loginRunner = new StubCodexInteractiveSessionLoginRegistry(setup.codexHome);
    const manager = new DesktopConnectionManager(
      {
        databasePath: setup.dbPath,
        agentHomes: { codex: setup.codexHome },
        environment: EnvironmentSource.empty(),
        credentialStore: setup.credentialStore,
      },
      loginRunner,
    );

    const draft = await manager.prepareConnectionDraft({
      preset: "openai",
      authMode: "openai_session",
      sessionSource: "login",
    });

    manager.discardPreparedConnectionDraft({ draftId: draft.id });

    await expect(manager.savePreparedConnection({ draftId: draft.id })).rejects.toThrow(
      "Prepared connection draft not found",
    );
  });

  it("expires prepared drafts after the configured ttl", async () => {
    vi.useFakeTimers();
    const setup = createSetup();
    const loginRunner = new StubCodexInteractiveSessionLoginRegistry(setup.codexHome);
    const manager = new DesktopConnectionManager(
      {
        databasePath: setup.dbPath,
        agentHomes: { codex: setup.codexHome },
        environment: EnvironmentSource.empty(),
        credentialStore: setup.credentialStore,
        preparedDraftTtlMs: 1_000,
      },
      loginRunner,
    );

    const draft = await manager.prepareConnectionDraft({
      preset: "openai",
      authMode: "openai_session",
      sessionSource: "login",
    });

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(manager.savePreparedConnection({ draftId: draft.id })).rejects.toThrow(
      "Prepared connection draft not found",
    );
  });

  it("evicts the oldest prepared draft when the cache reaches capacity", async () => {
    const setup = createSetup();
    const loginRunner = new StubCodexInteractiveSessionLoginRegistry(setup.codexHome);
    const manager = new DesktopConnectionManager(
      {
        databasePath: setup.dbPath,
        agentHomes: { codex: setup.codexHome },
        environment: EnvironmentSource.empty(),
        credentialStore: setup.credentialStore,
        maxPreparedDrafts: 1,
      },
      loginRunner,
    );

    const first = await manager.prepareConnectionDraft({
      preset: "openai",
      authMode: "openai_session",
      sessionSource: "login",
    });
    const second = await manager.prepareConnectionDraft({
      preset: "openai",
      authMode: "openai_session",
      sessionSource: "login",
    });

    await expect(manager.savePreparedConnection({ draftId: first.id })).rejects.toThrow(
      "Prepared connection draft not found",
    );
    await expect(manager.savePreparedConnection({ draftId: second.id })).resolves.toEqual(
      expect.objectContaining({
        endpointId: "openai",
        endpointFamily: "openai",
      }),
    );
  });

  it("clears prepared drafts when the desktop window is dismissed", async () => {
    const setup = createSetup();
    const loginRunner = new StubCodexInteractiveSessionLoginRegistry(setup.codexHome);
    const manager = new DesktopConnectionManager(
      {
        databasePath: setup.dbPath,
        agentHomes: { codex: setup.codexHome },
        environment: EnvironmentSource.empty(),
        credentialStore: setup.credentialStore,
      },
      loginRunner,
    );

    const draft = await manager.prepareConnectionDraft({
      preset: "openai",
      authMode: "openai_session",
      sessionSource: "login",
    });

    manager.clearPreparedConnectionDrafts();

    await expect(manager.savePreparedConnection({ draftId: draft.id })).rejects.toThrow(
      "Prepared connection draft not found",
    );
  });

  it("binds Cursor usage for a saved cursor_session connection", () => {
    const setup = createSetup();
    seedCursorConnection(setup);
    const gateway = new DesktopConnectionGateway({
      databasePath: setup.dbPath,
      agentHomes: { cursor: setup.cursorHome },
      environment: EnvironmentSource.empty(),
      credentialStore: setup.credentialStore,
    });

    const result = gateway.bindCursorUsage("cursor-work", CURSOR_WEB_SESSION_TOKEN);

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

  it("auto-binds cursor usage after importing the current cursor session connection", async () => {
    const setup = createSetup();
    writeCursorSessionConfig(setup.cursorHome);
    const browserHome = mkdtempSync(join(tmpdir(), "nile-browser-home-"));
    tempDirs.push(browserHome);
    writeChromiumCursorCookies(
      join(browserHome, "Library", "Application Support", "Google", "Chrome", "Profile 1", "Cookies"),
      SAFE_STORAGE_SECRET,
    );
    process.env.NILE_BROWSER_HOME = browserHome;
    SecurityCli.prototype.run = function (args: string[]): SecurityCliResult {
      if (args[0] !== "find-generic-password") {
        return {
          exitCode: 44,
          stdout: "",
          stderr: "item could not be found",
        };
      }
      if (args.includes("cursor-access-token")) {
        return { exitCode: 0, stdout: "cursor-access\n", stderr: "" };
      }
      if (args.includes("cursor-refresh-token")) {
        return { exitCode: 0, stdout: "cursor-refresh\n", stderr: "" };
      }
      if (args.includes("Chrome Safe Storage")) {
        return { exitCode: 0, stdout: `${SAFE_STORAGE_SECRET}\n`, stderr: "" };
      }
      return {
        exitCode: 44,
        stdout: "",
        stderr: "item could not be found",
      };
    };

    const gateway = new DesktopConnectionGateway({
      databasePath: setup.dbPath,
      agentHomes: { cursor: setup.cursorHome },
      environment: EnvironmentSource.empty(),
      credentialStore: setup.credentialStore,
    });

    const imported = await gateway.importCurrentConnection("cursor");
    const bindingRegistry = CursorUsageBindingRegistry.open(setup.dbPath, setup.credentialStore);
    try {
      expect(imported).toEqual(
        expect.objectContaining({
          endpointFamily: "cursor",
          authMode: "cursor_session",
        }),
      );
      expect(bindingRegistry.get(imported.id)).toEqual(
        expect.objectContaining({
          connectionId: imported.id,
          accountFingerprint: expect.objectContaining({
            workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
          }),
        }),
      );
    } finally {
      bindingRegistry.close();
    }
  });

  it("auto-enables a configurable connection for an agent before switching", async () => {
    const updateCalls: Array<{ connectionId: string; enabledAgents?: string[] }> = [];
    const useCalls: Array<[string, string]> = [];
    const sessionStub = {
      listSavedConnections: () => [{
        id: "gateway-shared-api-key",
        endpointId: "gateway-shared",
        endpointUrl: "https://llmfk.dpdns.org/v1",
        label: "Gateway (llmfk.dpdns.org) API Key",
        endpointLabel: "Gateway (llmfk.dpdns.org)",
        endpointFamily: "gateway",
        authMode: "api_key",
        apiKeySource: "direct" as const,
        envKey: "NILE_GATEWAY_LLMFK_DPDNS_ORG_API_KEY_API_KEY",
        enabledAgents: ["codex", "claude"],
        configurableAgents: ["codex", "claude", "openclaw"],
        selectedByAgents: ["claude"],
      }],
      updateConnection: async (input: { connectionId: string; enabledAgents?: string[] }) => {
        updateCalls.push(input);
        return {
          id: "gateway-shared-api-key",
          endpointId: "gateway-shared",
          endpointUrl: "https://llmfk.dpdns.org/v1",
          label: "Gateway (llmfk.dpdns.org) API Key",
          endpointLabel: "Gateway (llmfk.dpdns.org)",
          endpointFamily: "gateway",
          authMode: "api_key",
          apiKeySource: "direct" as const,
          envKey: "NILE_GATEWAY_LLMFK_DPDNS_ORG_API_KEY_API_KEY",
          enabledAgents: ["codex", "claude", "openclaw"],
          configurableAgents: ["codex", "claude", "openclaw"],
          selectedByAgents: ["claude"],
        };
      },
      useConnection: (agentId: string, connectionId: string) => {
        useCalls.push([agentId, connectionId]);
        return {
          agentId,
          connectionId,
          connectionLabel: "Gateway (llmfk.dpdns.org) API Key",
          endpointId: "gateway-shared",
          endpointLabel: "Gateway (llmfk.dpdns.org)",
          appliedAt: "2026-05-11T00:00:00.000Z",
        };
      },
      getAgentStatus: () => ({
        agent: "openclaw",
        currentConnection: {
          id: "gateway-shared-api-key",
          label: "Gateway (llmfk.dpdns.org) API Key",
          endpointId: "gateway-shared",
          endpointLabel: "Gateway (llmfk.dpdns.org)",
          endpointFamily: "gateway",
          authMode: "api_key",
        },
        currentConnectionState: "saved" as const,
        liveConnection: null,
        reconciliation: { state: "already_saved", validity: "valid_matched" } as const,
      }),
      close: () => {},
    };

    class SessionStubbedDesktopConnectionGateway extends DesktopConnectionGateway {
      override openSession(): never {
        return sessionStub as never;
      }
    }

    const setup = createSetup();
    const gateway = new SessionStubbedDesktopConnectionGateway({
      databasePath: setup.dbPath,
      environment: EnvironmentSource.empty(),
      credentialStore: setup.credentialStore,
    });

    await gateway.switchConnection("openclaw", "gateway-shared-api-key");

    expect(updateCalls).toEqual([{
      connectionId: "gateway-shared-api-key",
      enabledAgents: ["codex", "claude", "openclaw"],
    }]);
    expect(useCalls).toEqual([["openclaw", "gateway-shared-api-key"]]);
  });

  it("ensures managed env keys for batch detected-setup imports", async () => {
    const ensureCalls: string[] = [];
    const sessionStub = {
      getAgentStatus: () => ({
        reconciliation: { state: "unavailable", issues: [] },
      }),
      scanLocalSetups: () => ({ items: [] }),
      captureMatchedImportState: vi.fn(),
      restoreMatchedImportState: vi.fn(),
      importDetectedSetups: async () => ({
        results: [
          {
            scanId: "claude",
            status: "created" as const,
            connectionId: "gateway-shared-api-key",
            connectionLabel: "Gateway (llmfk.dpdns.org) API Key",
          },
          {
            scanId: "codex",
            status: "created" as const,
            connectionId: "work-session",
            connectionLabel: "Work Session",
          },
        ],
      }),
      close: () => {},
    };

    class SessionStubbedDesktopConnectionGateway extends DesktopConnectionGateway {
      override openSession(): never {
        return sessionStub as never;
      }
    }

    const setup = createSetup();
    const gateway = new SessionStubbedDesktopConnectionGateway({
      databasePath: setup.dbPath,
      environment: EnvironmentSource.empty(),
      credentialStore: setup.credentialStore,
      managedApiKeyEnvironment: {
        ensureForConnection: async (_session: unknown, connectionId: string) => {
          ensureCalls.push(connectionId);
          return null;
        },
        removeForConnection: () => {},
      } as never,
    });

    const result = await gateway.importDetectedSetups(["claude", "codex"]);

    expect(result.results).toEqual([
      {
        scanId: "claude",
        status: "created",
        connectionId: "gateway-shared-api-key",
        connectionLabel: "Gateway (llmfk.dpdns.org) API Key",
      },
      {
        scanId: "codex",
        status: "created",
        connectionId: "work-session",
        connectionLabel: "Work Session",
      },
    ]);
    expect(ensureCalls).toEqual(["gateway-shared-api-key", "work-session"]);
  });

  it("rolls back a newly imported connection when managed env promotion fails", async () => {
    const removeConnection = vi.fn();
    const restoreMatchedImportState = vi.fn();
    const sessionStub = {
      getAgentStatus: () => ({
        reconciliation: { state: "unavailable", issues: [] },
      }),
      scanLocalSetups: () => ({ items: [] }),
      captureMatchedImportState: vi.fn(),
      restoreMatchedImportState,
      importCurrentConnection: async () => ({
        id: "gateway-shared-api-key",
        label: "Gateway (llmfk.dpdns.org) API Key",
        endpointId: "gateway-shared",
        endpointLabel: "Gateway (llmfk.dpdns.org)",
        endpointFamily: "gateway" as const,
        authMode: "api_key" as const,
      }),
      removeConnection,
      close: () => {},
    };

    class SessionStubbedDesktopConnectionGateway extends DesktopConnectionGateway {
      override openSession(): never {
        return sessionStub as never;
      }
    }

    const setup = createSetup();
    const gateway = new SessionStubbedDesktopConnectionGateway({
      databasePath: setup.dbPath,
      environment: EnvironmentSource.empty(),
      credentialStore: setup.credentialStore,
      managedApiKeyEnvironment: {
        ensureForConnection: async () => {
          throw new Error("keychain unavailable");
        },
        removeForConnection: () => {},
      } as never,
    });

    await expect(gateway.importCurrentConnection("claude")).rejects.toThrow("keychain unavailable");
    expect(removeConnection).toHaveBeenCalledWith("gateway-shared-api-key");
    expect(restoreMatchedImportState).not.toHaveBeenCalled();
  });

  it("restores a reused import when managed env promotion fails", async () => {
    const restoreMatchedImportState = vi.fn();
    const snapshot = {
      agentId: "claude",
      connectionId: "gateway-shared-api-key",
      endpointId: "gateway-shared",
      endpointProtocols: {
        anthropic: {
          authSchemes: ["x-api-key"],
        },
      },
      identityKey: null,
      credential: {
        kind: "api_key",
        source: "direct",
        apiKey: "gateway-secret",
      },
      selection: null,
      modelSetting: null,
    };
    const sessionStub = {
      getAgentStatus: () => ({
        agentId: "claude",
        liveConnection: {
          id: "gateway-shared-api-key",
          label: "Gateway (llmfk.dpdns.org) API Key",
        },
        currentSelection: null,
        currentConnection: null,
        currentConnectionState: "none" as const,
        rollback: "unsupported" as const,
        supportsHistory: false,
        detectedSetup: null,
        issues: [],
        reconciliation: { state: "already_saved" as const },
      }),
      captureMatchedImportState: vi.fn(() => snapshot),
      restoreMatchedImportState,
      importCurrentConnection: async () => ({
        id: "gateway-shared-api-key",
        label: "Gateway (llmfk.dpdns.org) API Key",
        endpointId: "gateway-shared",
        endpointLabel: "Gateway (llmfk.dpdns.org)",
        endpointFamily: "gateway" as const,
        authMode: "api_key" as const,
        reused: true,
      }),
      close: () => {},
    };

    class SessionStubbedDesktopConnectionGateway extends DesktopConnectionGateway {
      override openSession(): never {
        return sessionStub as never;
      }
    }

    const setup = createSetup();
    const gateway = new SessionStubbedDesktopConnectionGateway({
      databasePath: setup.dbPath,
      environment: EnvironmentSource.empty(),
      credentialStore: setup.credentialStore,
      managedApiKeyEnvironment: {
        ensureForConnection: async () => {
          throw new Error("keychain unavailable");
        },
        removeForConnection: () => {},
      } as never,
    });

    await expect(gateway.importCurrentConnection("claude")).rejects.toThrow("keychain unavailable");
    expect(restoreMatchedImportState).toHaveBeenCalledWith(snapshot);
  });

  it("marks batch imports as failed when managed env promotion fails for a created connection", async () => {
    const removeConnection = vi.fn();
    const removeForConnection = vi.fn();
    const sessionStub = {
      getAgentStatus: () => ({
        reconciliation: { state: "unavailable", issues: [] },
      }),
      scanLocalSetups: () => ({ items: [] }),
      captureMatchedImportState: vi.fn(),
      restoreMatchedImportState: vi.fn(),
      importDetectedSetups: async () => ({
        results: [
          {
            scanId: "claude",
            status: "created" as const,
            connectionId: "gateway-shared-api-key",
            connectionLabel: "Gateway (llmfk.dpdns.org) API Key",
          },
        ],
      }),
      removeConnection,
      close: () => {},
    };

    class SessionStubbedDesktopConnectionGateway extends DesktopConnectionGateway {
      override openSession(): never {
        return sessionStub as never;
      }
    }

    const setup = createSetup();
    const gateway = new SessionStubbedDesktopConnectionGateway({
      databasePath: setup.dbPath,
      environment: EnvironmentSource.empty(),
      credentialStore: setup.credentialStore,
      managedApiKeyEnvironment: {
        ensureForConnection: async () => {
          throw new Error("keychain unavailable");
        },
        removeForConnection,
      } as never,
    });

    const result = await gateway.importDetectedSetups(["claude"]);

    expect(result.results).toEqual([
      {
        scanId: "claude",
        status: "failed",
        message: "keychain unavailable",
      },
    ]);
    expect(removeForConnection).toHaveBeenCalledWith(sessionStub, "gateway-shared-api-key");
    expect(removeConnection).toHaveBeenCalledWith("gateway-shared-api-key");
  });

  it("restores reused batch imports when managed env promotion fails", async () => {
    const restoreMatchedImportState = vi.fn();
    const snapshot = {
      agentId: "claude",
      connectionId: "gateway-shared-api-key",
      endpointId: "gateway-shared",
      endpointProtocols: {
        anthropic: {
          authSchemes: ["x-api-key"],
        },
      },
      identityKey: null,
      credential: {
        kind: "api_key",
        source: "direct",
        apiKey: "gateway-secret",
      },
      selection: null,
      modelSetting: null,
    };
    const sessionStub = {
      getAgentStatus: () => ({
        agentId: "claude",
        liveConnection: {
          id: "gateway-shared-api-key",
          label: "Gateway (llmfk.dpdns.org) API Key",
        },
        currentSelection: null,
        currentConnection: null,
        currentConnectionState: "none" as const,
        rollback: "unsupported" as const,
        supportsHistory: false,
        detectedSetup: null,
        issues: [],
        reconciliation: { state: "already_saved" as const },
      }),
      captureMatchedImportState: vi.fn(() => snapshot),
      restoreMatchedImportState,
      importDetectedSetups: async () => ({
        results: [
          {
            scanId: "claude",
            status: "reused" as const,
            connectionId: "gateway-shared-api-key",
            connectionLabel: "Gateway (llmfk.dpdns.org) API Key",
          },
        ],
      }),
      close: () => {},
    };

    class SessionStubbedDesktopConnectionGateway extends DesktopConnectionGateway {
      override openSession(): never {
        return sessionStub as never;
      }
    }

    const setup = createSetup();
    const gateway = new SessionStubbedDesktopConnectionGateway({
      databasePath: setup.dbPath,
      environment: EnvironmentSource.empty(),
      credentialStore: setup.credentialStore,
      managedApiKeyEnvironment: {
        ensureForConnection: async () => {
          throw new Error("keychain unavailable");
        },
      } as never,
    });

    const result = await gateway.importDetectedSetups(["claude"]);

    expect(result.results).toEqual([
      {
        scanId: "claude",
        status: "failed",
        message: "keychain unavailable",
      },
    ]);
    expect(restoreMatchedImportState).toHaveBeenCalledWith(snapshot);
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
  geminiHome: string;
  credentialStore: StubCredentialStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-connection-manager-"));
  tempDirs.push(dir);
  const codexHome = join(dir, ".codex");
  const claudeHome = join(dir, ".claude");
  const cursorHome = join(dir, ".cursor");
  const geminiHome = join(dir, ".gemini");
  mkdirSync(codexHome, { recursive: true });
  mkdirSync(claudeHome, { recursive: true });
  mkdirSync(cursorHome, { recursive: true });
  mkdirSync(geminiHome, { recursive: true });

  return {
    dbPath: join(dir, "switcher.sqlite"),
    codexHome,
    claudeHome,
    cursorHome,
    geminiHome,
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

function buildUnsignedJwt(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
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

function writeCursorSessionConfig(cursorHome: string): void {
  writeFileSync(
    join(cursorHome, "cli-config.json"),
    `${JSON.stringify({
      serverConfigCache: {
        backendUrl: "https://api2.cursor.sh",
        authCacheKey: "auth:auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
      },
      authInfo: {
        authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
        email: "cursor.user@example.com",
        displayName: "Cursor User",
      },
    }, null, 2)}\n`,
    "utf8",
  );
}

function writeGeminiSession(geminiHome: string, email: string, subject: string): void {
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
      id_token: buildUnsignedJwt({
        email,
        sub: subject,
      }),
    }, null, 2)}\n`,
    "utf8",
  );
}

class StubCredentialStore extends KeychainCredentialStore {
  private readonly credentials = new Map<string, StoredCredential>();

  override create(target: CredentialStoreTarget, credential: StoredCredential): void {
    this.credentials.set(normalizeCredentialStoreTarget(target).reference, credential);
  }

  override update(target: CredentialStoreTarget, credential: StoredCredential): void {
    this.credentials.set(normalizeCredentialStoreTarget(target).reference, credential);
  }

  override get(target: CredentialStoreTarget): StoredCredential {
    const credentialId = normalizeCredentialStoreTarget(target).reference;
    const credential = this.credentials.get(credentialId);
    if (!credential) {
      throw new Error(`Missing stub credential: ${credentialId}`);
    }
    return credential;
  }

  override has(target: CredentialStoreTarget): boolean {
    return this.credentials.has(normalizeCredentialStoreTarget(target).reference);
  }

  override remove(target: CredentialStoreTarget): void {
    this.credentials.delete(normalizeCredentialStoreTarget(target).reference);
  }
}

class DenyingCredentialStore extends KeychainCredentialStore {
  override create(_target: CredentialStoreTarget, _credential: StoredCredential): void {
    throw new SystemSecureCredentialStoreDeniedError();
  }
}

class StubCodexInteractiveSessionLoginRegistry implements Pick<InteractiveSessionLoginRegistry, "signInAndRead"> {
  readonly signInCalls: string[] = [];
  readonly commandOverrides: Array<string | null> = [];
  readonly openExternalCalls: string[] = [];

  constructor(
    private readonly codexHome: string,
    private readonly loginUrl?: string,
  ) {}

  async signInAndRead(context: InteractiveSessionLoginContext): Promise<{
    kind: "openai_session";
    idToken: string;
    accessToken: string;
    refreshToken: string;
    accountId: string;
    lastRefresh: string;
  }> {
    this.signInCalls.push(this.codexHome);
    this.commandOverrides.push(context.agentRuntimeCommandOverrides?.codex ?? null);
    if (this.loginUrl && context.openExternalUrl) {
      await context.openExternalUrl(this.loginUrl);
      this.openExternalCalls.push(this.loginUrl);
    }
    writeOpenAiSession(this.codexHome, "acct-signed-in");
    return {
      kind: "openai_session",
      idToken: buildUnsignedJwt({ email: "signed-in@example.com", sub: "acct-signed-in" }),
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accountId: "acct-signed-in",
      lastRefresh: "2026-04-27T00:00:00.000Z",
    };
  }
}

class StubClaudeInteractiveSessionLoginRegistry implements Pick<InteractiveSessionLoginRegistry, "signInAndRead"> {
  readonly signInCalls: string[] = [];

  constructor(private readonly claudeHome: string) {}

  async signInAndRead(): Promise<{
    kind: "claude_session";
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    accountUuid: string;
    organizationUuid: string;
    email: string;
    displayName: string;
  }> {
    this.signInCalls.push(this.claudeHome);
    writeClaudeSession(this.claudeHome);
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

class StubGeminiInteractiveSessionLoginRegistry implements Pick<InteractiveSessionLoginRegistry, "signInAndRead"> {
  readonly signInCalls: string[] = [];

  constructor(private readonly geminiHome: string) {}

  async signInAndRead(): Promise<{
    kind: "gemini_cli_session";
    accessToken: string;
    refreshToken: string;
    idToken: string;
  }> {
    this.signInCalls.push(this.geminiHome);
    writeGeminiSession(this.geminiHome, "signed-in-gemini@example.com", "gemini-sub-signed-in");
    return {
      kind: "gemini_cli_session",
      accessToken: "gemini-access-token",
      refreshToken: "gemini-refresh-token",
      idToken: buildUnsignedJwt({
        email: "signed-in-gemini@example.com",
        sub: "gemini-sub-signed-in",
      }),
    };
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
const SAFE_STORAGE_SECRET = "AAAAAAAAAAAAAAAAAAAAAA==";

function writeChromiumCursorCookies(databasePath: string, safeStorageSecret: string): void {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  try {
    db.exec(
      [
        "create table cookies (",
        "host_key text not null,",
        "name text not null,",
        "value text not null,",
        "encrypted_value blob not null",
        ");",
      ].join(" "),
    );
    insertCookie(db, "cursor.com", "WorkosCursorSessionToken", encryptCookieValue(CURSOR_WEB_SESSION_TOKEN.split("::")[1]!, safeStorageSecret));
    insertCookie(db, "cursor.com", "workos_id", encryptCookieValue("user_01K03K41CNGRCADY5VT0JPH69Y", safeStorageSecret));
    insertCookie(db, ".cursor.com", "cursor-web-target-synced-user", encryptCookieValue("user_01K03K41CNGRCADY5VT0JPH69Y", safeStorageSecret));
  } finally {
    db.close();
  }
}

function insertCookie(db: DatabaseSync, hostKey: string, name: string, encryptedValue: Buffer): void {
  db.prepare(
    "insert into cookies (host_key, name, value, encrypted_value) values (?, ?, '', ?)",
  ).run(hostKey, name, encryptedValue);
}

function encryptCookieValue(value: string, safeStorageSecret: string): Buffer {
  const key = pbkdf2Sync(safeStorageSecret, "saltysalt", 1003, 16, "sha1");
  const iv = Buffer.alloc(16, 0x20);
  const cipher = createCipheriv("aes-128-cbc", key, iv);
  return Buffer.concat([Buffer.from("v10"), cipher.update(value, "utf8"), cipher.final()]);
}
