import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "@nile/core/models/access";
import { EndpointRegistry, type EndpointRegistryInput } from "@nile/core/models/endpoint";
import { AgentSelection } from "@nile/core/models/selection";
import { NileSession } from "@nile/core/runtime-local";
import { KeychainCredentialStore, type StoredCredential } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import { SecureSnapshotStore } from "@nile/core/services/history";

import { DesktopSurface } from "./Surface";

const tempDirs: string[] = [];
const originalFetch = globalThis.fetch;

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
  delete process.env.OPENAI_API_KEY3;
  globalThis.fetch = originalFetch;
});

describe("DesktopSurface", () => {
  it("shows the current connection and quick-switch connections for the menubar", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "openai-official",
      label: "OpenAI Official",
      endpointFamily: "openai",
      supportedAuthModes: ["openai_session", "api_key"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "work",
        endpointId: "openai-official",
        label: "Work",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "secret-1" },
    );
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "personal",
        endpointId: "openai-official",
        label: "Personal",
        authMode: "openai_session",
      },
      openAiSessionCredential(),
    );

    const surface = createSurface(setup);
    applySavedConnection(setup, "codex", "work");

    expect(await surface.getMenubarState()).toEqual({
      agents: [
        expect.objectContaining({
          agentId: "codex",
          agentLabel: "Codex",
          currentConnection: {
            activeAlertCount: 0,
            apiKeySource: "direct",
            id: "work",
            label: "Work",
            appliedAt: expect.any(String),
            endpointLabel: "OpenAI Official",
            endpointFamily: "openai",
            authMode: "api_key",
            isCurrent: true,
            enabledAgents: ["codex"],
            configurableAgents: ["codex", "openclaw"],
            selectedByAgents: ["codex"],
            endpointUrl: "https://api.openai.com/v1",
            envKey: null,
          },
          currentUsage: null,
          connections: [
            expect.objectContaining({
              apiKeySource: "direct",
              id: "work",
              label: "Work",
              endpointLabel: "OpenAI Official",
              endpointFamily: "openai",
              authMode: "api_key",
              isCurrent: true,
              usage: null,
              enabledAgents: ["codex"],
              configurableAgents: ["codex", "openclaw"],
              selectedByAgents: ["codex"],
              endpointUrl: "https://api.openai.com/v1",
              envKey: null,
            }),
            expect.objectContaining({
              id: "personal",
              label: "Personal",
              endpointLabel: "OpenAI Official",
              endpointFamily: "openai",
              authMode: "openai_session",
              isCurrent: false,
              usage: null,
              enabledAgents: ["codex"],
              configurableAgents: ["codex", "openclaw"],
              selectedByAgents: [],
              endpointUrl: "https://api.openai.com/v1",
            }),
          ],
        }),
        {
          agentId: "cursor",
          agentLabel: "Cursor",
          currentConnection: null,
          currentUsage: null,
          connections: [],
        },
        {
          agentId: "claude",
          agentLabel: "Claude",
          currentConnection: null,
          currentUsage: null,
          connections: [],
        },
        {
          agentId: "openclaw",
          agentLabel: "OpenClaw",
          currentConnection: null,
          currentUsage: null,
          connections: expect.arrayContaining([
            expect.objectContaining({
              apiKeySource: "direct",
              id: "work",
              label: "Work",
              endpointLabel: "OpenAI Official",
              endpointFamily: "openai",
              authMode: "api_key",
              isCurrent: false,
              usage: null,
              enabledAgents: ["codex"],
              configurableAgents: ["codex", "openclaw"],
              selectedByAgents: ["codex"],
              endpointUrl: "https://api.openai.com/v1",
              envKey: null,
            }),
            expect.objectContaining({
              id: "personal",
              label: "Personal",
              endpointLabel: "OpenAI Official",
              endpointFamily: "openai",
              authMode: "openai_session",
              isCurrent: false,
              usage: null,
              enabledAgents: ["codex"],
              configurableAgents: ["codex", "openclaw"],
              selectedByAgents: [],
              endpointUrl: "https://api.openai.com/v1",
            }),
          ]),
        },
      ],
    });
  });

  it("shows settings state as current, live, sync state, and saved connections", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "azure-work",
      label: "Azure Work",
      endpointFamily: "azure-openai",
      supportedAuthModes: ["api_key"],
      connectionMetadata: {
        baseUrl: "https://example.cognitiveservices.azure.com/openai/v1",
      },
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "azure-account",
        endpointId: "azure-work",
        label: "Azure Account",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "azure-secret" },
    );
    process.env.OPENAI_API_KEY3 = "azure-secret";
    writeFileSync(
      join(setup.codexHome, "config.toml"),
      [
        'model = "gpt-5.4"',
        'model_provider = "azure-work"',
        "",
        '[model_providers.azure-work]',
        'base_url = "https://example.cognitiveservices.azure.com/openai/v1"',
        'wire_api = "responses"',
        'env_key = "OPENAI_API_KEY3"',
        "",
      ].join("\n"),
      "utf8",
    );

    const surface = createSurface(setup);

    expect(await surface.getSettingsState()).toEqual({
      onboarding: null,
      currentConnection: expect.objectContaining({
        activeAlertCount: 0,
        apiKeySource: "direct",
        appliedAt: expect.any(String),
        id: "azure-account",
        label: "Azure Account",
        endpointLabel: "Azure Work",
        endpointFamily: "azure-openai",
        authMode: "api_key",
        isCurrent: true,
        enabledAgents: ["codex"],
        configurableAgents: ["codex", "openclaw"],
        selectedByAgents: [],
        endpointUrl: "https://example.cognitiveservices.azure.com/openai/v1",
        envKey: null,
      }),
      currentConnectionState: "saved",
      liveConnection: expect.objectContaining({
        activeAlertCount: 0,
        agentModelId: "gpt-5.4",
        apiKeySource: "direct",
        id: "azure-account",
        label: "Azure Account",
        endpointLabel: "Azure Work",
        endpointFamily: "azure-openai",
        authMode: "api_key",
        isCurrent: true,
        enabledAgents: ["codex"],
        configurableAgents: ["codex", "openclaw"],
        selectedByAgents: [],
        endpointUrl: "https://example.cognitiveservices.azure.com/openai/v1",
        envKey: null,
      }),
      reconciliationState: "already_saved",
      connections: [
        expect.objectContaining({
          apiKeySource: "direct",
          id: "azure-account",
          label: "Azure Account",
          endpointLabel: "Azure Work",
          endpointFamily: "azure-openai",
          authMode: "api_key",
          isCurrent: true,
          usage: null,
          enabledAgents: ["codex"],
          configurableAgents: ["codex", "openclaw"],
          selectedByAgents: ["codex"],
          endpointUrl: "https://example.cognitiveservices.azure.com/openai/v1",
          envKey: null,
        }),
      ],
      currentAgentConnections: [
        expect.objectContaining({
          activeAlertCount: 0,
          agentModelId: "gpt-5.4",
          apiKeySource: "direct",
          applyRequirements: {
            canApply: true,
            requirements: [],
          },
          id: "azure-account",
          label: "Azure Account",
          endpointLabel: "Azure Work",
          endpointFamily: "azure-openai",
          authMode: "api_key",
          isCurrent: true,
          usage: null,
          enabledAgents: ["codex"],
          configurableAgents: ["codex", "openclaw"],
          selectedByAgents: ["codex"],
          endpointUrl: "https://example.cognitiveservices.azure.com/openai/v1",
          envKey: null,
        }),
      ],
      agents: expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex",
          connections: expect.arrayContaining([
            expect.objectContaining({ id: "azure-account", agentModelId: "gpt-5.4" }),
          ]),
        }),
      ]),
      detectedSetups: expect.objectContaining({
        importableCount: 0,
      }),
      advanced: expect.objectContaining({
        savedConnectionCount: 1,
        importableSetupCount: 0,
      }),
    });
  });

  it("marks an orphaned current connection in settings after the saved connection is removed", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "openai",
      label: "OpenAI",
      endpointFamily: "openai",
      supportedAuthModes: ["api_key"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "openai-work",
        endpointId: "openai",
        label: "OpenAI Work",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "secret-openai" },
    );

    const surface = createSurface(setup);
    applySavedConnection(setup, "codex", "openai-work");

    const session = NileSession.open({
      databasePath: setup.dbPath,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
      logger: NileLogger.silent().child({ module: "desktop-surface-test" }),
      agentHomes: {
        codex: setup.codexHome,
        cursor: setup.cursorHome,
        claude: setup.claudeHome,
        openclaw: setup.openclawHome,
      },
    });
    try {
      session.removeConnection("openai-work");
    } finally {
      session.close();
    }

    expect(await surface.getSettingsState()).toEqual({
      onboarding: expect.objectContaining({
        mode: "single",
        importableCount: 1,
      }),
      currentConnection: null,
      currentConnectionState: "none",
      liveConnection: {
        activeAlertCount: 0,
        agentModelId: "gpt-5.4",
        id: "OpenAI API Key",
        label: "OpenAI API Key",
        endpointLabel: "OpenAI",
        endpointFamily: "openai",
        authMode: "api_key",
        isCurrent: false,
        enabledAgents: [],
        configurableAgents: [],
        selectedByAgents: [],
        endpointUrl: null,
      },
      reconciliationState: "new",
      connections: [],
      currentAgentConnections: [],
      agents: expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex",
          currentConnection: null,
          currentConnectionState: "none",
          reconciliationState: "new",
        }),
      ]),
      detectedSetups: expect.objectContaining({
        importableCount: 1,
      }),
      advanced: expect.objectContaining({
        savedConnectionCount: 0,
      }),
    });
  });

  it("does not surface a saved multi-protocol gateway as a new Codex setup", async () => {
    const setup = createSetup({
      authFile: { OPENAI_API_KEY: "gateway-secret" },
      configToml: [
        'model = "gpt-5.4"',
        'model_provider = "gateway-shared"',
        "",
        '[model_providers.gateway-shared]',
        'name = "Gateway (gateway.example.test)"',
        'base_url = "https://gateway.example.test/v1"',
        'wire_api = "responses"',
        'env_key = "OPENAI_API_KEY"',
        "",
      ].join("\n"),
    });
    seedProvider(setup.dbPath, {
      id: "gateway-shared",
      label: "Gateway (gateway.example.test)",
      endpointFamily: "gateway",
      connectionMetadata: {
        baseUrl: "https://gateway.example.test/v1",
      },
    });
    const endpointRegistry = EndpointRegistry.open(setup.dbPath);
    endpointRegistry.update("gateway-shared", {
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: ["responses"],
          authSchemes: ["bearer"],
          envKeyOverride: "OPENAI_API_KEY",
        },
        anthropic: {
          basePath: "/v1",
          authSchemes: ["bearer"],
          envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
          versionHeader: "2023-06-01",
        },
      },
    });
    endpointRegistry.close();
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "gateway-work",
        endpointId: "gateway-shared",
        label: "Gateway (gateway.example.test) API Key",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "gateway-secret" },
    );

    const surface = createSurface(setup);
    const state = await surface.getSettingsState();

    expect(state.detectedSetups.importableCount).toBe(0);
    expect(state.detectedSetups.items).toEqual([
      expect.objectContaining({
        agentId: "codex",
        importable: false,
        reconciliationState: "already_saved",
      }),
      expect.objectContaining({
        agentId: "cursor",
        importable: false,
      }),
      expect.objectContaining({
        agentId: "claude",
        importable: false,
      }),
      expect.objectContaining({
        agentId: "openclaw",
        importable: false,
      }),
    ]);
    expect(state.agents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        agentId: "codex",
        reconciliationState: "already_saved",
        liveConnection: expect.objectContaining({
          id: "gateway-work",
          label: "Gateway (gateway.example.test) API Key",
        }),
      }),
    ]));
  });

  it("shows configurable gateway connections in the OpenClaw agent list even before OpenClaw is enabled", async () => {
    const setup = createSetup();
    const endpointRegistry = EndpointRegistry.open(setup.dbPath);
    endpointRegistry.add({
      id: "gateway-shared",
      label: "Gateway (llmfk.dpdns.org)",
      rootUrl: "https://llmfk.dpdns.org",
      profile: "generic-gateway",
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: ["responses"],
          authSchemes: ["bearer"],
          envKeyOverride: "OPENAI_API_KEY",
        },
        anthropic: {
          basePath: "/v1",
          authSchemes: ["bearer"],
          envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
          versionHeader: "2023-06-01",
        },
      },
    });
    endpointRegistry.close();
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "gateway-shared-api-key",
        endpointId: "gateway-shared",
        label: "Gateway (llmfk.dpdns.org) API Key",
        authMode: "api_key",
      },
      {
        kind: "api_key",
        source: "direct",
        apiKey: "gateway-secret",
        envKey: "NILE_GATEWAY_LLMFK_DPDNS_ORG_API_KEY_API_KEY",
      },
    );
    await updateConnectionEnabledAgents(setup, "gateway-shared-api-key", ["codex", "claude"]);

    const surface = createSurface(setup);
    const state = await surface.getSettingsState();
    const openClawState = state.agents.find((agent) => agent.agentId === "openclaw");

    expect(openClawState?.connections).toEqual([
      expect.objectContaining({
        id: "gateway-shared-api-key",
        enabledAgents: ["codex", "claude"],
        configurableAgents: ["codex", "claude", "openclaw"],
      }),
    ]);
  });

  it("filters current-agent connections to Codex-compatible entries only", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "openai-official",
      label: "OpenAI Official",
      endpointFamily: "openai",
      supportedAuthModes: ["api_key"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "codex-work",
        endpointId: "openai-official",
        label: "Codex Work",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "secret-codex" },
    );
    seedProvider(setup.dbPath, {
      id: "anthropic-team",
      label: "Anthropic Team",
      endpointFamily: "anthropic",
      supportedAuthModes: ["api_key"],
      agentCompatibility: ["claude"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "claude-team",
        endpointId: "anthropic-team",
        label: "Claude Team",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "secret-claude" },
    );

    const state = await createSurface(setup).getSettingsState();
    expect(state.onboarding).toBeNull();
    expect(state.connections.map((connection) => connection.id)).toEqual(["claude-team", "codex-work"]);
    expect(state.currentAgentConnections.map((connection) => connection.id)).toEqual(["codex-work"]);
    expect(state.agents.find((agent) => agent.agentId === "claude")?.connections.map((connection) => connection.id)).toEqual(["claude-team"]);
  });

  it("includes configurable Codex connections in current-agent connections even before they are enabled", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "openai-official",
      label: "OpenAI Official",
      endpointFamily: "openai",
      supportedAuthModes: ["api_key"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "shared-openai",
        endpointId: "openai-official",
        label: "Shared OpenAI",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "shared-secret" },
    );
    await updateConnectionEnabledAgents(setup, "shared-openai", ["openclaw"]);

    const state = await createSurface(setup).getSettingsState();
    expect(state.currentAgentConnections.map((connection) => connection.id)).toEqual(["shared-openai"]);
  });

  it("includes agent-specific model settings in agent connection lists", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "openai-official",
      label: "OpenAI Official",
      endpointFamily: "openai",
      supportedAuthModes: ["openai_session", "api_key"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "shared-work",
        endpointId: "openai-official",
        label: "Shared Work",
        authMode: "openai_session",
      },
      openAiSessionCredential(),
    );
    await updateConnectionEnabledAgents(setup, "shared-work", ["codex", "openclaw"]);
    setAgentConnectionModel(setup, "openclaw", "shared-work", "gpt-5.3-codex");

    const state = await createSurface(setup).getSettingsState();

    expect(
      state.agents.find((agent) => agent.agentId === "openclaw")?.connections.find((connection) => connection.id === "shared-work"),
    ).toEqual(
      expect.objectContaining({
        id: "shared-work",
        agentModelId: "gpt-5.3-codex",
      }),
    );
    expect(
      state.agents.find((agent) => agent.agentId === "codex")?.connections.find((connection) => connection.id === "shared-work")?.agentModelId,
    ).toBeNull();
  });

  it("returns a first-run onboarding state when no saved connections exist yet", async () => {
    const setup = createSetup();
    const state = await createSurface(setup).getSettingsState();

    expect(state.onboarding).toEqual({
      mode: "single",
      importableCount: 1,
      items: expect.arrayContaining([
        {
          scanId: "codex",
          agentId: "codex",
          title: "Codex · OpenAI API Key",
          subtitle: "OpenAI • api_key",
          reconciliationState: "new",
          importable: true,
          defaultSelected: true,
          issues: [],
        },
        expect.objectContaining({
          scanId: "cursor",
          agentId: "cursor",
          reconciliationState: "invalid",
          importable: false,
          defaultSelected: false,
        }),
        {
          scanId: "claude",
          agentId: "claude",
          title: "Claude · No local setup",
          subtitle: "Claude settings.json has no ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN",
          reconciliationState: "invalid",
          importable: false,
          defaultSelected: false,
          issues: ["Claude settings.json has no ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN"],
        },
      ]),
    });
    expect(state.onboarding).not.toBeNull();
    expect(state.detectedSetups).toEqual(state.onboarding!);
    expect(state.advanced).toEqual(
      expect.objectContaining({
        savedConnectionCount: 0,
        importableSetupCount: 1,
      }),
    );
  });

  it("shows live drift in menubar when the current codex setup is not saved yet", async () => {
    const setup = createSetup();
    process.env.OPENAI_API_KEY3 = "azure-secret";
    writeFileSync(
      join(setup.codexHome, "config.toml"),
      [
        'model = "gpt-5.4"',
        'model_provider = "azure"',
        "",
        '[model_providers.azure]',
        'base_url = "https://example-eu-resource.cognitiveservices.azure.com/openai/v1"',
        'wire_api = "responses"',
        'env_key = "OPENAI_API_KEY3"',
        "",
      ].join("\n"),
      "utf8",
    );

    const surface = createSurface(setup);

    expect(await surface.getMenubarState()).toEqual({
      agents: [
        {
          agentId: "codex",
          agentLabel: "Codex",
          currentConnection: null,
          currentUsage: null,
          connections: [],
        },
        {
          agentId: "cursor",
          agentLabel: "Cursor",
          currentConnection: null,
          currentUsage: null,
          connections: [],
        },
        {
          agentId: "claude",
          agentLabel: "Claude",
          currentConnection: null,
          currentUsage: null,
          connections: [],
        },
        {
          agentId: "openclaw",
          agentLabel: "OpenClaw",
          currentConnection: null,
          currentUsage: null,
          connections: [],
        },
      ],
    });
  });

  it("switches connections through the shared apply flow", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "router",
      label: "OpenRouter",
      endpointFamily: "gateway",
      supportedAuthModes: ["api_key"],
      connectionMetadata: {
        baseUrl: "https://router.example/v1",
      },
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "router-account",
        endpointId: "router",
        label: "Router Account",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "router-secret" },
    );

    applySavedConnection(setup, "codex", "router-account");

    const state = await createSurface(setup).getSettingsState();
    expect(state.currentConnection?.id).toBe("router-account");
    expect(readFile(setup.codexHome, "auth.json")).toContain("router-secret");
    expect(readFile(setup.codexHome, "config.toml")).toContain('model_provider = "router"');
  });

  it("shows recent mutation history and rolls back the latest Codex change", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "router",
      label: "OpenRouter",
      endpointFamily: "gateway",
      supportedAuthModes: ["api_key"],
      connectionMetadata: {
        baseUrl: "https://router.example/v1",
      },
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "router-account",
        endpointId: "router",
        label: "Router Account",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "router-secret" },
    );

    const surface = createSurface(setup);
    applySavedConnection(setup, "codex", "router-account");

    const history = await surface.getHistoryState();
    expect(history.agents.find((agent) => agent.agentId === "codex")?.latestRollbackableMutationId).toBeTruthy();
    expect(history.entries).toHaveLength(1);
    expect(history.entries[0].agentId).toBe("codex");
    expect(history.entries[0].connectionLabel).toBe("Router Account");
    expect(history.entries[0].status).toBe("applied");

    const rollback = await surface.rollbackLatestMutation("codex");
    expect(rollback.agentId).toBe("codex");

    const updatedHistory = await surface.getHistoryState();
    expect(updatedHistory.entries).toHaveLength(2);
    expect(updatedHistory.entries[0].status).toBe("rolled_back");
    expect(updatedHistory.entries[1].status).toBe("applied");
    expect(readFile(setup.codexHome, "config.toml")).toContain('model_provider = "legacy"');
  });

  it("shows the tightest usage window for the current menubar connection", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "openai-official",
      label: "OpenAI Official",
      endpointFamily: "openai",
      supportedAuthModes: ["openai_session"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "personal",
        endpointId: "openai-official",
        label: "Personal",
        authMode: "openai_session",
      },
      openAiSessionCredential(),
    );
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({
        plan_type: "plus",
        rate_limit: {
          primary_window: { used_percent: 40, limit_window_seconds: 18_000, reset_at: 1_770_000_000 },
          secondary_window: { used_percent: 70, limit_window_seconds: 604_800, reset_at: 1_770_500_000 },
        },
      }), { status: 200 })) as unknown as typeof fetch;

    const surface = createSurface(setup);
    applySavedConnection(setup, "codex", "personal");
    await surface.refreshMenubarUsage();

    const state = await surface.getMenubarState();
    expect(state.agents[0]?.currentUsage).toEqual({
      status: "available",
      planLabel: "Plus",
      windows: [
        { key: "5h", label: "5h", remainingPercent: 60, resetsAt: "2026-02-02T02:40:00.000Z" },
        { key: "weekly", label: "weekly", remainingPercent: 30, resetsAt: "2026-02-07T21:33:20.000Z" },
      ],
      windowLabel: "weekly",
      remainingPercent: 30,
      text: "weekly 30% left",
    });
  });

  it("includes usage summaries in desktop settings connection rows", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "openai-official",
      label: "OpenAI Official",
      endpointFamily: "openai",
      supportedAuthModes: ["openai_session"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "personal",
        endpointId: "openai-official",
        label: "Personal",
        authMode: "openai_session",
      },
      openAiSessionCredential(),
    );
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({
        plan_type: "plus",
        rate_limit: {
          primary_window: { used_percent: 15, limit_window_seconds: 18_000, reset_at: 1_770_000_000 },
          secondary_window: { used_percent: 10, limit_window_seconds: 604_800, reset_at: 1_770_500_000 },
        },
      }), { status: 200 })) as unknown as typeof fetch;

    const state = await createSurface(setup).getSettingsState();
    expect(state.connections[0]?.usage).toEqual({
      status: "available",
      planLabel: "Plus",
      windows: [
        { key: "5h", label: "5h", remainingPercent: 85, resetsAt: "2026-02-02T02:40:00.000Z" },
        { key: "weekly", label: "weekly", remainingPercent: 90, resetsAt: "2026-02-07T21:33:20.000Z" },
      ],
      windowLabel: "5h",
      remainingPercent: 85,
      text: "5h 85% left",
    });
  });

  it("can read desktop settings from cached usage without refreshing usage", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "openai-official",
      label: "OpenAI Official",
      endpointFamily: "openai",
      supportedAuthModes: ["openai_session"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "personal",
        endpointId: "openai-official",
        label: "Personal",
        authMode: "openai_session",
      },
      openAiSessionCredential(),
    );
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({}), { status: 500 });
    }) as unknown as typeof fetch;

    const state = await createSurface(setup).getSettingsState({ refreshUsage: false });

    expect(fetchCalls).toBe(0);
    expect(state.connections[0]?.usage).toBeNull();
  });

  it("omits connection usage in settings rows when no usage snapshot is available", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "cursor-backend",
      label: "Cursor",
      endpointFamily: "cursor",
      supportedAuthModes: ["cursor_session"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "cursor-work",
        endpointId: "cursor-backend",
        label: "Cursor Work",
        authMode: "cursor_session",
      },
      cursorSessionCredential(),
    );

    const state = await createSurface(setup).getSettingsState();
    expect(state.connections[0]?.usage).toBeNull();
  });

  it("prefers the matched live saved connection over the stale selected connection", async () => {
    const setup = createSetup({
      configToml: [
        'model = "gpt-5.4"',
        'model_provider = "openai-official"',
        "",
        "[model_providers.openai-official]",
        'name = "OpenAI Official"',
        'base_url = "https://api.openai.com/v1"',
        'wire_api = "responses"',
        "",
      ].join("\n"),
      authFile: {
        OPENAI_API_KEY: null,
        tokens: {
          id_token: "header.eyJlbWFpbCI6ImFjdGl2ZUBleGFtcGxlLmNvbSJ9.signature",
          access_token: "active-access-token",
          refresh_token: "active-refresh-token",
          account_id: "acct-active",
        },
        last_refresh: "2026-04-25T00:00:00.000Z",
      },
    });
    seedProvider(setup.dbPath, {
      id: "openai-official",
      label: "OpenAI Official",
      endpointFamily: "openai",
      supportedAuthModes: ["openai_session"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "previous",
        endpointId: "openai-official",
        label: "previous@example.com",
        authMode: "openai_session",
        identityKey: "account:acct-previous",
      },
      openAiSessionCredential({
        accountId: "acct-previous",
        accessToken: "previous-access-token",
        refreshToken: "previous-refresh-token",
      }),
    );
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "active",
        endpointId: "openai-official",
        label: "active@example.com",
        authMode: "openai_session",
        identityKey: "account:acct-active",
      },
      openAiSessionCredential({
        accountId: "acct-active",
        accessToken: "active-access-token",
        refreshToken: "active-refresh-token",
      }),
    );

    const agentSelection = AgentSelection.open(setup.dbPath);
    agentSelection.setApplied("codex", "previous", "2026-04-25T00:00:00.000Z");
    agentSelection.close();

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({
        plan_type: "prolite",
        rate_limit: {
          primary_window: { used_percent: 4, limit_window_seconds: 18_000, reset_at: 1_777_430_300 },
          secondary_window: { used_percent: 66, limit_window_seconds: 604_800, reset_at: 1_777_511_900 },
        },
        additional_rate_limits: [
          {
            limit_name: "GPT-5.3-Codex-Spark",
            rate_limit: {
              primary_window: { used_percent: 0, limit_window_seconds: 18_000, reset_at: 1_777_431_500 },
            },
          },
        ],
      }), { status: 200 })) as unknown as typeof fetch;

    const state = await createSurface(setup).getSettingsState();

    expect(state.currentConnection?.id).toBe("active");
    expect(state.currentConnection?.label).toBe("active@example.com");
    expect(state.liveConnection?.id).toBe("active");
    expect(state.reconciliationState).toBe("already_saved");
    expect(state.connections[0]?.id).toBe("active");
    expect(state.connections[0]?.isCurrent).toBe(true);
    expect(state.connections[0]?.selectedByAgents).toEqual(["codex"]);
    expect(state.connections[1]?.id).toBe("previous");
    expect(state.connections[1]?.isCurrent).toBe(false);
    expect(state.connections[1]?.selectedByAgents).toEqual([]);
    expect(state.agents.find((agent) => agent.agentId === "codex")?.currentUsage).toEqual(
      expect.objectContaining({
        status: "available",
        planLabel: "Pro Lite",
        windowLabel: "weekly",
        remainingPercent: 34,
        text: "weekly 34% left",
        windows: [
          { key: "5h", label: "5h", remainingPercent: 96, resetsAt: "2026-04-29T02:38:20.000Z" },
          { key: "weekly", label: "weekly", remainingPercent: 34, resetsAt: "2026-04-30T01:18:20.000Z" },
          { key: "gpt-5.3-codex-spark", label: "GPT-5.3-Codex-Spark", remainingPercent: 100, resetsAt: "2026-04-29T02:58:20.000Z" },
        ],
      }),
    );
  });
});

function createSetup(options?: {
  authFile?: Record<string, unknown>;
  configToml?: string;
}): {
  dbPath: string;
  codexHome: string;
  cursorHome: string;
  claudeHome: string;
  openclawHome: string;
  credentialStore: StubCredentialStore;
  secureSnapshots: MemorySecureSnapshotStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-"));
  tempDirs.push(dir);

  const codexHome = join(dir, ".codex");
  mkdirSync(codexHome, { recursive: true });
  writeFileSync(
    join(codexHome, "config.toml"),
    options?.configToml ?? 'model = "gpt-5.4"\nmodel_provider = "legacy"\n',
    "utf8",
  );
  writeFileSync(
    join(codexHome, "auth.json"),
    `${JSON.stringify(options?.authFile ?? { OPENAI_API_KEY: "legacy-key" }, null, 2)}\n`,
    "utf8",
  );

  const cursorHome = join(dir, ".cursor");
  mkdirSync(cursorHome, { recursive: true });
  writeFileSync(join(cursorHome, "cli-config.json"), "{}\n", "utf8");

  const claudeHome = join(dir, ".claude");
  mkdirSync(claudeHome, { recursive: true });
  writeFileSync(join(claudeHome, "settings.json"), "{}\n", "utf8");

  const openclawHome = join(dir, ".openclaw");
  mkdirSync(openclawHome, { recursive: true });
  writeFileSync(join(openclawHome, "openclaw.json"), "{ models: { mode: 'merge', providers: {} } }\n", "utf8");

  return {
    dbPath: join(dir, "switcher.sqlite"),
    codexHome,
    cursorHome,
    claudeHome,
    openclawHome,
    credentialStore: new StubCredentialStore(),
    secureSnapshots: new MemorySecureSnapshotStore(),
  };
}

function createSurface(setup: {
  dbPath: string;
  codexHome: string;
  cursorHome: string;
  claudeHome: string;
  openclawHome: string;
  credentialStore: StubCredentialStore;
  secureSnapshots: MemorySecureSnapshotStore;
}): DesktopSurface {
  return new DesktopSurface({
    databasePath: setup.dbPath,
    agentHomes: {
      codex: setup.codexHome,
      cursor: setup.cursorHome,
      claude: setup.claudeHome,
      openclaw: setup.openclawHome,
    },
    credentialStore: setup.credentialStore,
    secureSnapshotStore: setup.secureSnapshots,
    logger: NileLogger.silent(),
  });
}

function applySavedConnection(
  setup: {
    dbPath: string;
    codexHome: string;
    cursorHome: string;
    claudeHome: string;
    openclawHome: string;
    credentialStore: StubCredentialStore;
    secureSnapshots: MemorySecureSnapshotStore;
  },
  agentId: "codex" | "cursor" | "claude" | "openclaw",
  connectionId: string,
): void {
  const session = NileSession.open({
    databasePath: setup.dbPath,
    credentialStore: setup.credentialStore,
    secureSnapshotStore: setup.secureSnapshots,
    logger: NileLogger.silent().child({ module: "desktop-surface-test" }),
    agentHomes: {
      codex: setup.codexHome,
      cursor: setup.cursorHome,
      claude: setup.claudeHome,
      openclaw: setup.openclawHome,
    },
  });
  try {
    session.useConnection(agentId, connectionId);
  } finally {
    session.close();
  }
}

function setAgentConnectionModel(
  setup: {
    dbPath: string;
    codexHome: string;
    cursorHome: string;
    claudeHome: string;
    openclawHome: string;
    credentialStore: StubCredentialStore;
    secureSnapshots: MemorySecureSnapshotStore;
  },
  agentId: "codex" | "cursor" | "claude" | "openclaw",
  connectionId: string,
  modelId: string,
): void {
  const session = NileSession.open({
    databasePath: setup.dbPath,
    credentialStore: setup.credentialStore,
    secureSnapshotStore: setup.secureSnapshots,
    logger: NileLogger.silent().child({ module: "desktop-surface-test" }),
    agentHomes: {
      codex: setup.codexHome,
      cursor: setup.cursorHome,
      claude: setup.claudeHome,
      openclaw: setup.openclawHome,
    },
  });
  try {
    session.setAgentConnectionModel(agentId, connectionId, modelId);
  } finally {
    session.close();
  }
}

async function updateConnectionEnabledAgents(
  setup: {
    dbPath: string;
    codexHome: string;
    cursorHome: string;
    claudeHome: string;
    openclawHome: string;
    credentialStore: StubCredentialStore;
    secureSnapshots: MemorySecureSnapshotStore;
  },
  connectionId: string,
  enabledAgents: Array<"codex" | "cursor" | "claude" | "openclaw">,
): Promise<void> {
  const session = NileSession.open({
    databasePath: setup.dbPath,
    credentialStore: setup.credentialStore,
    secureSnapshotStore: setup.secureSnapshots,
    logger: NileLogger.silent().child({ module: "desktop-surface-test" }),
    agentHomes: {
      codex: setup.codexHome,
      cursor: setup.cursorHome,
      claude: setup.claudeHome,
      openclaw: setup.openclawHome,
    },
  });
  try {
    await session.updateConnection({
      connectionId,
      enabledAgents,
    });
  } finally {
    session.close();
  }
}

function seedProvider(
  dbPath: string,
  input: {
    id: string;
    label: string;
    endpointFamily: "openai" | "gateway" | "azure-openai" | "anthropic" | "cursor";
    supportedAuthModes?: Array<"api_key" | "openai_session" | "claude_session" | "cursor_session">;
    agentCompatibility?: Array<"codex" | "cursor" | "claude">;
    connectionMetadata?: {
      baseUrl?: string;
      backendUrl?: string;
      envKey?: string;
      wireApi?: "chat" | "responses";
    };
  },
): void {
  const endpointRegistry = EndpointRegistry.open(dbPath);
  endpointRegistry.add(buildEndpointInput(input));
  endpointRegistry.close();
}

function seedBinding(
  dbPath: string,
  credentialStore: StubCredentialStore,
  input: {
    id: string;
    endpointId: string;
    label: string;
    authMode: "api_key" | "openai_session" | "claude_session" | "cursor_session";
    identityKey?: string;
  },
  credential: StoredCredential,
): void {
  credentialStore.create(`access:${input.id}`, credential);

  const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
  accessRegistry.add({
    id: input.id,
    endpointId: input.endpointId,
    label: input.label,
    authMode: input.authMode,
    identityKey: input.identityKey,
  }, credential);
  accessRegistry.close();
}

function buildEndpointInput(input: {
  id: string;
  label: string;
  endpointFamily: "openai" | "gateway" | "azure-openai" | "anthropic" | "cursor";
  connectionMetadata?: {
    baseUrl?: string;
    backendUrl?: string;
    envKey?: string;
    wireApi?: "chat" | "responses";
  };
}): EndpointRegistryInput {
  if (input.endpointFamily === "cursor") {
    const backendUrl = input.connectionMetadata?.backendUrl ?? "https://api2.cursor.sh";
    const url = new URL(backendUrl);
    return {
      id: input.id,
      label: input.label,
      rootUrl: url.origin,
      profile: "cursor-backend",
      protocols: {
        cursor: {
          backendPath: url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, ""),
        },
      },
    };
  }

  if (input.endpointFamily === "anthropic") {
    const baseUrl = input.connectionMetadata?.baseUrl ?? "https://api.anthropic.com/v1";
    const url = new URL(baseUrl);
    return {
      id: input.id,
      label: input.label,
      rootUrl: url.origin,
      profile: url.origin === "https://api.anthropic.com" ? "anthropic-official" : "generic-gateway",
      protocols: {
        anthropic: {
          basePath: url.pathname === "/" ? "/v1" : url.pathname.replace(/\/+$/, ""),
          authSchemes: [
            input.connectionMetadata?.envKey === "ANTHROPIC_AUTH_TOKEN" ? "bearer" : "x_api_key",
          ],
          envKeyOverride:
            input.connectionMetadata?.envKey === "ANTHROPIC_AUTH_TOKEN"
              ? "ANTHROPIC_AUTH_TOKEN"
              : "ANTHROPIC_API_KEY",
          versionHeader: "2023-06-01",
        },
      },
    };
  }

  const baseUrl =
    input.connectionMetadata?.baseUrl ??
    (input.endpointFamily === "azure-openai"
      ? "https://example.cognitiveservices.azure.com/openai/v1"
      : "https://api.openai.com/v1");
  const url = new URL(baseUrl);

  return {
    id: input.id,
    label: input.label,
    rootUrl: url.origin,
    profile:
      input.endpointFamily === "openai"
        ? "openai-official"
        : input.endpointFamily === "azure-openai"
          ? "azure-openai"
          : "generic-gateway",
    protocols: {
      openai: {
        basePath: url.pathname === "/" ? "/v1" : url.pathname.replace(/\/+$/, ""),
        wireApis: [input.connectionMetadata?.wireApi ?? "responses"],
        authSchemes: ["bearer"],
        envKeyOverride: input.connectionMetadata?.envKey ?? "OPENAI_API_KEY",
      },
    },
  };
}

function readFile(codexHome: string, name: string): string {
  return readFileSync(join(codexHome, name), "utf8");
}

function openAiSessionCredential(
  overrides?: Partial<Extract<StoredCredential, { kind: "openai_session" }>>,
): StoredCredential {
  return {
    kind: "openai_session",
    idToken: overrides?.idToken ?? "id-token",
    accessToken: overrides?.accessToken ?? "access-token",
    refreshToken: overrides?.refreshToken ?? "refresh-token",
    accountId: overrides?.accountId ?? "acct-123",
    lastRefresh: overrides?.lastRefresh ?? "2026-04-25T00:00:00.000Z",
  };
}

function cursorSessionCredential(): StoredCredential {
  return {
    kind: "cursor_session",
    accessToken: "cursor-access-token",
    refreshToken: "cursor-refresh-token",
    authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
    authCacheKey: "cache-key",
    email: "cursor@example.com",
    displayName: "Cursor User",
  };
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

class MemorySecureSnapshotStore extends SecureSnapshotStore {
  private readonly snapshots = new Map<string, string>();

  override writeBeforeSnapshot(snapshotRef: string, content: string | null) {
    this.snapshots.set(snapshotRef, content ?? "");
    return {
      snapshotRef,
      checksum: this.checksum(content),
    };
  }

  override restoreSnapshot(snapshotRef: string, targetPath: string, existedBefore: boolean): void {
    if (!existedBefore) {
      rmSync(targetPath, { force: true });
      return;
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, this.snapshots.get(snapshotRef) ?? "", { encoding: "utf8", mode: 0o600 });
  }
}
