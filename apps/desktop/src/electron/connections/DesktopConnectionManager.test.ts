import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ClaudeSessionLogin, CodexSessionLogin } from "@nile/core/agents";
import { AccessRegistry } from "@nile/core/models/access";
import { EndpointRegistry } from "@nile/core/models/endpoint";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { KeychainCredentialStore, type StoredCredential } from "@nile/core/services/credential";

import { DesktopConnectionGateway } from "./DesktopConnectionGateway";
import { DesktopConnectionManager } from "./DesktopConnectionManager";

const tempDirs: string[] = [];
const originalFetch = globalThis.fetch;

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
  globalThis.fetch = originalFetch;
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

  it("discards prepared drafts that are abandoned before save", async () => {
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

    const draft = await manager.prepareConnectionDraft({
      preset: "openai",
      authMode: "openai_session",
      openAiSessionSource: "login",
    });

    manager.discardPreparedConnectionDraft({ draftId: draft.id });

    await expect(manager.savePreparedConnection({ draftId: draft.id })).rejects.toThrow(
      "Prepared connection draft not found",
    );
  });

  it("expires prepared drafts after the configured ttl", async () => {
    vi.useFakeTimers();
    const setup = createSetup();
    const loginRunner = new StubCodexSessionLogin();
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
      openAiSessionSource: "login",
    });

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(manager.savePreparedConnection({ draftId: draft.id })).rejects.toThrow(
      "Prepared connection draft not found",
    );
  });

  it("evicts the oldest prepared draft when the cache reaches capacity", async () => {
    const setup = createSetup();
    const loginRunner = new StubCodexSessionLogin();
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
      openAiSessionSource: "login",
    });
    const second = await manager.prepareConnectionDraft({
      preset: "openai",
      authMode: "openai_session",
      openAiSessionSource: "login",
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

    const draft = await manager.prepareConnectionDraft({
      preset: "openai",
      authMode: "openai_session",
      openAiSessionSource: "login",
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
      scanLocalSetups: () => ({ items: [] }),
      captureMatchedImportState: vi.fn(),
      restoreMatchedImportState,
      importCurrentConnectionWithLocalEffects: async () => ({
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
      importCurrentConnectionWithLocalEffects: async () => ({
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
