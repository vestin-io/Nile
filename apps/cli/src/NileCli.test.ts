import { afterEach, describe, expect, it } from "vitest";
import { createCipheriv, pbkdf2Sync } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";

import { AccessRegistry } from "@nile/core/models/access";
import { EndpointRegistry, type EndpointRegistryInput } from "@nile/core/models/endpoint";
import { AgentSelection } from "@nile/core/models/selection";
import { KeychainCredentialStore, SecurityCli, type StoredCredential, type SecurityCliResult } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import { SecureSnapshotStore } from "@nile/core/services/history";
import { CodexSessionLogin } from "@nile/core/agents";
import { NileCli } from "./NileCli";
import { ConnectionCommands } from "./commands/ConnectionCommands";
import {
  InteractivePrompt,
  type CliInputResult,
  type CliMultiSelectResult,
  type CliSelectResult,
} from "./InteractivePrompt";
import { ConnectionSelectionFlow } from "./menu/ConnectionSelectionFlow";
import { ConnectionPresenter } from "./presenters/ConnectionPresenter";

const tempDirs: string[] = [];
const originalFetch = globalThis.fetch;
const originalSecurityCliRun = SecurityCli.prototype.run;

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
  delete process.env.OPENAI_API_KEY3;
  delete process.env.CURSOR_API_KEY;
  delete process.env.NILE_BROWSER_HOME;
  delete process.env.NILE_CURSOR_HOME;
  globalThis.fetch = originalFetch;
  SecurityCli.prototype.run = originalSecurityCliRun;
});

describe("NileCli", () => {
  it("shows null current connection before anything is applied", async () => {
    const setup = createSetup();
    const cli = createCli(setup);

    const result = await cli.run(["status"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("- Codex");
    expect(result.stdout).toContain("Endpoint: OpenAI");
    expect(result.stdout).toContain("Connection: OpenAI API Key");
    expect(result.stdout).toContain("State: new connection detected");
    expect(result.stdout).toContain("OpenAI");
    expect(result.stdout).toContain("OpenAI API Key");
    expect(result.stdout).toContain(
      "Hint: Current Codex setup is valid but not yet saved in Nile. Run: nile codex import",
    );
  });

  it("returns status json when requested", async () => {
    const setup = createSetup();
    const cli = createCli(setup);

    const result = await cli.run(["status", "--json"]);

    expect(result.exitCode).toBe(0);
    const statuses = JSON.parse(result.stdout) as Array<{ agent: string }>;
    expect(statuses).toHaveLength(4);
    const codex = statuses.find((s) => s.agent === "codex");
    expect(codex).toEqual(
      expect.objectContaining({
        currentConnection: null,
        currentConnectionState: "none",
        liveConnection: {
          label: "OpenAI API Key",
          endpointLabel: "OpenAI",
          endpointFamily: "openai",
          authMode: "api_key",
          modelId: "gpt-5.4",
        },
        reconciliation: { state: "new", hasLiveSetup: true },
      }),
    );
  });

  it("adds api_key connections through flags", async () => {
    const setup = createSetup();
    const cli = createCli(setup);

    const result = await cli.run([
      "add",
      "--preset",
      "azure-openai",
      "--auth-mode",
      "api_key",
      "--label",
      "Azure Account",
      "--endpoint-url",
      "https://example.cognitiveservices.azure.com/openai/v1",
      "--api-key",
      "azure-secret",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      "Connection created\nendpoint: Azure OpenAI (example)\nlabel: Azure Account\nid: azure-account\n",
    );
  });

  it("adds connections through flags with generated label and id", async () => {
    const setup = createSetup();
    const cli = createCli(setup);
    stubGatewayProbe();

    const result = await cli.run([
      "add",
      "--preset",
      "gateway",
      "--auth-mode",
      "api_key",
      "--endpoint-url",
      "https://router.example/v1",
      "--api-key",
      "router-secret",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      "Connection created\nendpoint: Gateway (router.example)\nlabel: API Key\nid: gateway-router-example-api-key\n",
    );
  });

  it("creates the default openai connection without requiring provider id", async () => {
    const setup = createSetup();
    const cli = createCli(setup);

    const result = await cli.run([
      "add",
      "--preset",
      "openai",
      "--auth-mode",
      "api_key",
      "--api-key",
      "secret-openai",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      "Connection created\nendpoint: OpenAI\nlabel: API Key\nid: openai-api-key\n",
    );
  });

  it("adds an OpenClaw-capable connection through flags and persists its model id", async () => {
    const setup = createSetup();
    const cli = createCli(setup);

    const result = await cli.run([
      "add",
      "--preset",
      "openai",
      "--auth-mode",
      "api_key",
      "--api-key",
      "secret-openai",
      "--model-id",
      "gpt-4.1",
    ]);
    const list = await cli.run(["list", "--json"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      "Connection created\nendpoint: OpenAI\nlabel: API Key\nid: openai-api-key\n",
    );
    expect(JSON.parse(list.stdout)).toEqual([
      expect.objectContaining({
        id: "openai-api-key",
        enabledAgents: ["codex", "openclaw"],
        configurableAgents: expect.arrayContaining(["codex", "openclaw"]),
      }),
    ]);
  });

  it("rejects explicit openclaw enablement without a model id", async () => {
    const setup = createSetup();
    const cli = createCli(setup);

    const result = await cli.run([
      "add",
      "--preset",
      "openai",
      "--auth-mode",
      "api_key",
      "--api-key",
      "secret-openai",
      "--agents",
      "openclaw",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("add --agents openclaw requires --model-id");
  });

  it("adds openai_session connections by importing current codex auth", async () => {
    const setup = createSetup({
      authFile: openAiAuthFile("work@example.com"),
    });
    const cli = createCli(setup);

    const result = await cli.run([
      "add",
      "--preset",
      "openai",
      "--id",
      "work-session",
      "--label",
      "Work Session",
      "--auth-mode",
      "openai_session",
      "--from-codex-current",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      "Connection created\nendpoint: OpenAI\nlabel: Work Session\nid: work-session\n",
    );
  });

  it("adds openai_session connections by running codex login first", async () => {
    const setup = createSetup({
      authFile: openAiAuthFile("work@example.com"),
    });
    const loginRunner = new StubCodexLoginRunner();
    const cli = createCli(setup, undefined, loginRunner);

    const result = await cli.run([
      "add",
      "--preset",
      "openai",
      "--id",
      "work-session",
      "--label",
      "Work Session",
      "--auth-mode",
      "openai_session",
      "--login",
    ]);

    expect(result.exitCode).toBe(0);
    expect(loginRunner.invocations).toEqual([setup.codexHome]);
    expect(result.stdout).toBe(
      "Connection created\nendpoint: OpenAI\nlabel: Work Session\nid: work-session\n",
    );
  });

  it("dedupes openai_session connections by identity", async () => {
    const setup = createSetup({
      authFile: openAiAuthFile("work@example.com"),
    });
    const cli = createCli(setup);

    const first = await cli.run([
      "add",
      "--preset",
      "openai",
      "--auth-mode",
      "openai_session",
      "--from-codex-current",
    ]);
    const second = await cli.run([
      "add",
      "--preset",
      "openai",
      "--auth-mode",
      "openai_session",
      "--from-codex-current",
    ]);
    const list = await cli.run(["list", "--json"]);

    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(first.stdout).toBe(
      "Connection created\nendpoint: OpenAI\nlabel: work@example.com\nid: work-example-com\n",
    );
    expect(second.stdout).toBe(
      "Reused existing connection\nendpoint: OpenAI\nlabel: work@example.com\nid: work-example-com\n",
    );
    expect(JSON.parse(list.stdout)).toHaveLength(1);
  });

  it("supports interactive connection add with prompt selections", async () => {
    const setup = createSetup();
    stubGatewayProbe();
    const prompt = new StubInteractivePrompt(
      [
        { type: "selected", value: "add" },
        { type: "selected", value: "new" },
        { type: "selected", value: "gateway" },
        { type: "selected", value: "continue" },
        { type: "selected", values: ["codex", "claude"] },
        { type: "selected", value: "done" },
      ],
      [
        { type: "value", value: "https://router.example/v1" },
        { type: "value", value: "router-secret" },
        { type: "value", value: "OpenRouter" },
      ],
    );
    const cli = createCli(setup, prompt);

    const result = await cli.run([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(prompt.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Connection result",
          message: "Connection created\nendpoint: Gateway (router.example)\nlabel: OpenRouter\nid: openrouter",
        }),
      ]),
    );
  });

  it("supports interactive openai connection add", async () => {
    const setup = createSetup({
      authFile: openAiAuthFile("work@example.com"),
    });
    const prompt = new StubInteractivePrompt(
      [
        { type: "selected", value: "add" },
        { type: "selected", value: "new" },
        { type: "selected", value: "openai" },
        { type: "selected", value: "openai_session" },
        { type: "selected", value: "codex_current" },
        { type: "selected", values: ["codex"] },
        { type: "selected", value: "done" },
      ],
      [],
    );
    const cli = createCli(setup, prompt);

    const result = await cli.run([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(prompt.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Connection result",
          message: "Connection created\nendpoint: OpenAI\nlabel: work@example.com\nid: work-example-com",
        }),
      ]),
    );
  });

  it("supports interactive OpenClaw enablement during connection add", async () => {
    const setup = createSetup();
    const prompt = new StubInteractivePrompt(
      [
        { type: "selected", value: "add" },
        { type: "selected", value: "new" },
        { type: "selected", value: "openai" },
        { type: "selected", value: "api_key" },
        { type: "selected", values: ["openclaw"] },
        { type: "selected", value: "done" },
      ],
      [
        { type: "value", value: "secret-openai" },
        { type: "value", value: "OpenAI API Key" },
        { type: "value", value: "gpt-4.1" },
      ],
    );
    const cli = createCli(setup, prompt);

    const result = await cli.run([]);
    const list = await cli.run(["list", "--json"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(prompt.multiSelectCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          labels: expect.arrayContaining(["Codex", "OpenClaw"]),
        }),
      ]),
    );
    expect(prompt.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Connection result",
          message: "Connection created\nendpoint: OpenAI\nlabel: API Key\nid: openai-api-key",
        }),
      ]),
    );
    expect(JSON.parse(list.stdout)).toEqual([
      expect.objectContaining({
        id: "openai-api-key",
        enabledAgents: ["openclaw"],
        configurableAgents: expect.arrayContaining(["codex", "openclaw"]),
      }),
    ]);
  });

  it("does not prompt for connection label when openai session identity is known", async () => {
    const setup = createSetup({
      authFile: openAiAuthFile("signed@example.com"),
    });
    const prompt = new StubInteractivePrompt(
      [
        { type: "selected", value: "add" },
        { type: "selected", value: "new" },
        { type: "selected", value: "openai" },
        { type: "selected", value: "openai_session" },
        { type: "selected", value: "codex_current" },
        { type: "selected", values: ["codex"] },
        { type: "selected", value: "done" },
      ],
      [],
    );
    const cli = createCli(setup, prompt);

    const result = await cli.run([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(prompt.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Connection result",
          message: "Connection created\nendpoint: OpenAI\nlabel: signed@example.com\nid: signed-example-com",
        }),
      ]),
    );
  });

  it("hides import detected local setups when there is nothing new to save", async () => {
    const setup = createSetup({
      authFile: openAiAuthFile("work@example.com"),
    });
    const cli = createCli(setup);
    await cli.run([
      "add",
      "--preset",
      "openai",
      "--auth-mode",
      "openai_session",
      "--from-codex-current",
    ]);
    await cli.run(["codex", "use", "work-example-com"]);

    const prompt = new StubInteractivePrompt(
      [
        { type: "selected", value: "status" },
        { type: "cancel" },
      ],
      [],
    );
    const interactiveCli = createCli(setup, prompt);
    const result = await interactiveCli.run([]);

    expect(result.exitCode).toBe(0);
    const manageCall = prompt.selectCalls.find((call) => call.message === "Manage agent connections");
    expect(manageCall).toBeDefined();
    expect(manageCall!.labels.some((label) => label.includes("Import detected local setups"))).toBe(false);
  });

  it("shows import detected local setups when a new local setup is available", async () => {
    const setup = createSetup();
    const prompt = new StubInteractivePrompt(
      [
        { type: "selected", value: "status" },
        { type: "cancel" },
      ],
      [],
    );
    const cli = createCli(setup, prompt);
    const result = await cli.run([]);

    expect(result.exitCode).toBe(0);
    const manageCall = prompt.selectCalls.find((call) => call.message === "Manage agent connections");
    expect(manageCall).toBeDefined();
    expect(manageCall!.labels.some((label) => label.includes("Import detected local setups"))).toBe(true);
  });

  it("filters connection choices by agent compatibility in interactive status management", async () => {
    const setup = createSetup({
      authFile: openAiAuthFile("work@example.com"),
    });
    seedProvider(setup.dbPath, {
      id: "openai-official",
      label: "OpenAI Official",
      providerFamily: "openai",
      supportedAuthModes: ["openai_session"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "openai-work",
        providerId: "openai-official",
        label: "work@example.com",
        authMode: "openai_session",
      },
      {
        kind: "openai_session",
        idToken: createJwt({ email: "work@example.com" }),
        accessToken: "access-token",
        refreshToken: "refresh-token",
        accountId: "acct-123",
      },
    );
    seedProvider(setup.dbPath, {
      id: "cursor",
      label: "Cursor",
      providerFamily: "cursor",
      supportedAuthModes: ["cursor_session"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "cursor-work",
        providerId: "cursor",
        label: "cursor.user@example.com",
        authMode: "cursor_session",
      },
      {
        kind: "cursor_session",
        accessToken: "cursor-access",
        refreshToken: "cursor-refresh",
        email: "cursor.user@example.com",
        authId: "cursor-auth",
      },
    );
    await createCli(setup).run(["cursor", "use", "cursor-work"]);
    await createCli(setup).run(["codex", "use", "openai-work"]);

    const prompt = new StubInteractivePrompt(
      [{ type: "selected", value: "openai-work" }],
      [],
    );
    const commands = new ConnectionCommands(
      setup.credentialStore,
      prompt,
      new StubCodexLoginRunner(),
      NileLogger.silent(),
    );
    const selection = new ConnectionSelectionFlow(
      prompt,
      commands,
      new ConnectionPresenter(),
    );

    await selection.selectConnectionId(
      {
        databasePath: setup.dbPath,
        agentHomes: {
          codex: setup.codexHome,
          cursor: setup.cursorHome,
          claude: setup.claudeHome,
          openclaw: setup.openclawHome,
        },
        secureSnapshotStore: setup.secureSnapshots,
      },
      "codex",
      "Choose a connection for Codex",
      () => new Error("Cancelled"),
      true,
    );

    expect(prompt.selectCalls).toHaveLength(1);
    const chooseCall = prompt.selectCalls[0];
    expect(chooseCall.message).toBe("Choose a connection for Codex");
    expect(chooseCall!.labels).toEqual(
      expect.arrayContaining([
        expect.stringContaining("work@example.com"),
      ]),
    );
    expect(chooseCall!.labels.some((label) => label.includes("cursor.user@example.com"))).toBe(false);
  });

  it("shows an empty-state panel when an agent has no compatible saved connections", async () => {
    const setup = createSetup();
    const prompt = new StubInteractivePrompt(
      [
        { type: "selected", value: "status" },
        { type: "selected", value: "claude" },
        { type: "selected", value: "back" },
        { type: "cancel" },
      ],
      [],
    );
    const cli = createCli(setup, prompt);

    const result = await cli.run([]);

    expect(result.exitCode).toBe(0);
    expect(prompt.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "No saved connections",
          message: "No saved Claude connections yet. Import the current local setup or add a compatible connection first.",
        }),
      ]),
    );
  });

  it("shows an empty-state panel when removing without any saved connections", async () => {
    const setup = createSetup();
    const prompt = new StubInteractivePrompt(
      [
        { type: "selected", value: "remove" },
        { type: "selected", value: "back" },
        { type: "cancel" },
      ],
      [],
    );
    const cli = createCli(setup, prompt);

    const result = await cli.run([]);

    expect(result.exitCode).toBe(0);
    expect(prompt.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "No saved connections",
          message: "No saved connections yet. Add or import a connection first.",
        }),
      ]),
    );
  });

  it("imports detected local setups through the unified status entry", async () => {
    const setup = createSetup({
      configToml: [
        'model = "gpt-5.4"',
        'model_provider = "azure"',
        "",
        "[model_providers.azure]",
        'name = "Azure"',
        'base_url = "https://example-eu-resource.cognitiveservices.azure.com/openai/v1"',
        'wire_api = "responses"',
        'env_key = "OPENAI_API_KEY3"',
        "",
      ].join("\n"),
      authFile: { OPENAI_API_KEY: null },
    });
    process.env.OPENAI_API_KEY3 = "azure-secret";
    const prompt = new StubInteractivePrompt(
      [
        { type: "selected", value: "status" },
        { type: "selected", value: "import-detected" },
        { type: "selected", value: "done" },
      ],
      [],
    );
    const cli = createCli(setup, prompt);

    const result = await cli.run([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(prompt.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Connection saved",
          message: expect.stringContaining("Imported example-eu-resource API Key"),
        }),
      ]),
    );
  });

  it("treats interactive cancel as a clean exit", async () => {
    const setup = createSetup();
    const prompt = new StubInteractivePrompt([{ type: "cancel" }], []);
    const cli = createCli(setup, prompt);

    const result = await cli.run([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBeUndefined();
  });

  it("lets users go back after viewing current setup", async () => {
    const setup = createSetup();
    stubGatewayProbe();
    const prompt = new StubInteractivePrompt(
      [
        { type: "selected", value: "status" },
        { type: "back" },
        { type: "selected", value: "add" },
        { type: "selected", value: "new" },
        { type: "selected", value: "gateway" },
        { type: "selected", value: "continue" },
        { type: "selected", values: ["codex", "claude"] },
        { type: "selected", value: "done" },
      ],
      [
        { type: "value", value: "https://router.example/v1" },
        { type: "value", value: "router-secret" },
        { type: "value", value: "OpenRouter" },
      ],
    );
    const cli = createCli(setup, prompt);

    const result = await cli.run([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(prompt.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Current agent connections",
          message: expect.stringContaining("- Codex"),
        }),
        expect.objectContaining({
          title: "Connection result",
          message: "Connection created\nendpoint: Gateway (router.example)\nlabel: OpenRouter\nid: openrouter",
        }),
      ]),
    );
  });

  it("lets users go back after adding a connection", async () => {
    const setup = createSetup();
    stubGatewayProbe();
    const prompt = new StubInteractivePrompt(
      [
        { type: "selected", value: "add" },
        { type: "selected", value: "new" },
        { type: "selected", value: "gateway" },
        { type: "selected", value: "continue" },
        { type: "selected", values: ["codex", "claude"] },
        { type: "selected", value: "back" },
        { type: "selected", value: "status" },
        { type: "cancel" },
      ],
      [
        { type: "value", value: "https://router.example/v1" },
        { type: "value", value: "router-secret" },
        { type: "value", value: "OpenRouter" },
      ],
    );
    const cli = createCli(setup, prompt);

    const result = await cli.run([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(prompt.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Connection result",
          message: "Connection created\nendpoint: Gateway (router.example)\nlabel: OpenRouter\nid: openrouter",
        }),
        expect.objectContaining({
          title: "Current agent connections",
          message: expect.stringContaining("- Codex"),
        }),
      ]),
    );
  });

  it("lets users change the Codex connection from agent connections", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "openai-official",
      label: "OpenAI Official",
      providerFamily: "openai",
      supportedAuthModes: ["api_key"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "openai-work",
        providerId: "openai-official",
        label: "OpenAI Work",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "secret-openai" },
    );
    await createCli(setup).run(["codex", "use", "openai-work"]);
    const prompt = new StubInteractivePrompt(
      [
        { type: "selected", value: "status" },
        { type: "selected", value: "codex" },
        { type: "selected", value: "openai-work" },
        { type: "selected", value: "done" },
      ],
      [],
    );
    const cli = createCli(setup, prompt);

    const result = await cli.run([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(prompt.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Agent connection result",
          message: expect.stringContaining("Codex connection updated"),
        }),
      ]),
    );
    expect(JSON.parse(readFileSync(join(setup.codexHome, "auth.json"), "utf8"))).toEqual({
      OPENAI_API_KEY: "secret-openai",
    });
  });

  it("lets users go back from provider selection to add options", async () => {
    const setup = createSetup();
    const prompt = new StubInteractivePrompt(
      [
        { type: "selected", value: "add" },
        { type: "selected", value: "new" },
        { type: "back" },
        { type: "cancel" },
      ],
      [],
    );
    const cli = createCli(setup, prompt);

    const result = await cli.run([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBeUndefined();
  });

  it("lists connections with provider family and auth mode", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "azure-work",
      label: "Azure Work",
      providerFamily: "azure-openai",
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
        providerId: "azure-work",
        label: "Azure Account",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "azure-secret" },
    );
    const cli = createCli(setup);

    const result = await cli.run(["list", "--json"]);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([
      expect.objectContaining({
        id: "azure-account",
        label: "Azure Account",
        endpointLabel: "Azure Work",
        endpointFamily: "azure-openai",
        authMode: "api_key",
        selectedByAgents: [],
      }),
    ]);
  });

  it("imports the current azure codex live state as a connection", async () => {
    const setup = createSetup({
      configToml: [
        'model = "gpt-5.4"',
        'model_provider = "azure"',
        "",
        "[model_providers.azure]",
        'name = "Azure"',
        'base_url = "https://example-eu-resource.cognitiveservices.azure.com/openai/v1"',
        'wire_api = "responses"',
        'env_key = "OPENAI_API_KEY3"',
        "",
      ].join("\n"),
      authFile: { OPENAI_API_KEY: null },
    });
    process.env.OPENAI_API_KEY3 = "azure-secret";
    const cli = createCli(setup);

    const result = await cli.run(["codex", "import"]);
    const list = await cli.run(["list", "--json"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      "Imported current connection\nendpoint: Azure OpenAI (example-eu-resource)\nlabel: example-eu-resource API Key\nid: example-eu-resource-api-key\n",
    );
    expect(JSON.parse(list.stdout)).toEqual([
      expect.objectContaining({
        id: "example-eu-resource-api-key",
        label: "example-eu-resource API Key",
        endpointLabel: "Azure OpenAI (example-eu-resource)",
        endpointFamily: "azure-openai",
        authMode: "api_key",
        selectedByAgents: ["Codex"],
      }),
    ]);
  });

  it("imports the current cursor live state as a connection", async () => {
    const setup = createSetup({
      cursorConfigJson: {
        serverConfigCache: {
          backendUrl: "https://api2.cursor.sh",
        },
      },
    });
    process.env.CURSOR_API_KEY = "cursor-secret";
    const cli = createCli(setup);

    const result = await cli.run(["cursor", "import"]);
    const status = await cli.run(["cursor", "status"]);
    const list = await cli.run(["list", "--json"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      "Imported current connection\nendpoint: Cursor\nlabel: API Key\nid: cursor-api-key\n",
    );
    expect(status.exitCode).toBe(0);
    expect(status.stdout).toContain("- Cursor");
    expect(status.stdout).toContain("Endpoint: Cursor");
    expect(status.stdout).toContain("Connection: Cursor API Key");
    expect(status.stdout).toContain("State: synced");
    expect(JSON.parse(list.stdout)).toEqual([
      expect.objectContaining({
        id: "cursor-api-key",
        label: "Cursor API Key",
        endpointLabel: "Cursor",
        endpointFamily: "cursor",
        authMode: "api_key",
        selectedByAgents: ["Cursor"],
      }),
    ]);
  });

  it("shows synced for a matched live connection and auto-syncs the saved selection during status", async () => {
    const setup = createSetup({
      configToml: [
        'model_provider = "azure"',
        "",
        "[model_providers.azure]",
        'name = "Azure"',
        'base_url = "https://example-eu-resource.cognitiveservices.azure.com/openai/v1"',
        'wire_api = "responses"',
        'env_key = "OPENAI_API_KEY3"',
        "",
      ].join("\n"),
      authFile: { OPENAI_API_KEY: null },
    });
    process.env.OPENAI_API_KEY3 = "azure-secret";
    seedProvider(setup.dbPath, {
      id: "azure",
      label: "Azure OpenAI (example-eu-resource)",
      providerFamily: "azure-openai",
      supportedAuthModes: ["api_key"],
      connectionMetadata: {
        baseUrl: "https://example-eu-resource.cognitiveservices.azure.com/openai/v1",
      },
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "example-eu-resource-api-key",
        providerId: "azure",
        label: "example-eu-resource API Key",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "azure-secret" },
    );
    const cli = createCli(setup);

    const result = await cli.run(["status"]);
    const agentSelection = AgentSelection.open(setup.dbPath);
    try {
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("- Codex");
      expect(result.stdout).toContain("Endpoint: Azure OpenAI (example-eu-resource)");
      expect(result.stdout).toContain("Connection: example-eu-resource API Key");
      expect(result.stdout).toContain("State: synced");
      expect(result.stdout).toContain("Azure OpenAI (example-eu-resource)");
      expect(result.stdout).toContain("matches a saved Nile connection");
      expect(agentSelection.get("codex")).toEqual(
        expect.objectContaining({
          connectionId: "example-eu-resource-api-key",
        }),
      );
    } finally {
      agentSelection.close();
    }
  });

  it("applies a connection and updates status", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "openai-official",
      label: "OpenAI Official",
      providerFamily: "openai",
      supportedAuthModes: ["api_key"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "openai-work",
        providerId: "openai-official",
        label: "OpenAI Work",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "secret-openai" },
    );
    const cli = createCli(setup);

    const useResult = await cli.run(["codex", "use", "openai-work"]);
    const statusResult = await cli.run(["status"]);

    expect(useResult.exitCode).toBe(0);
    expect(useResult.stdout).toContain("Codex connection updated");
    expect(useResult.stdout).toContain("connection: OpenAI Work");
    expect(useResult.stdout).toContain("id: openai-work");
    expect(useResult.stdout).toContain("endpoint: OpenAI Official");
    expect(useResult.stdout).toContain("applied at:");
    expect(statusResult.stdout).toContain("- Codex");
    expect(statusResult.stdout).toContain("Endpoint: OpenAI Official");
    expect(statusResult.stdout).toContain("Connection: OpenAI Work");
    expect(statusResult.stdout).toContain("State: synced");
    expect(statusResult.stdout).toContain("OpenAI Official");
    expect(statusResult.stdout).toContain("OpenAI Work");
    expect(statusResult.stdout).toContain("synced");
    expect(statusResult.stdout).toContain(
      "Hint: Current Codex setup matches a saved Nile connection.",
    );
    expect(JSON.parse(readFileSync(join(setup.codexHome, "auth.json"), "utf8"))).toEqual({
      OPENAI_API_KEY: "secret-openai",
    });
  });

  it("rejects unscoped use commands", async () => {
    const setup = createSetup();
    const cli = createCli(setup);

    const result = await cli.run(["use", "some-connection"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("Unknown command: use some-connection");
  });

  it("rejects unscoped import commands", async () => {
    const setup = createSetup();
    const cli = createCli(setup);

    const result = await cli.run(["import"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe(
      "import requires an agent. Use `nile codex import`, `nile cursor import`, `nile claude import`, or `nile openclaw import`.",
    );
  });

  it("rejects unscoped rollback commands", async () => {
    const setup = createSetup();
    const cli = createCli(setup);

    const result = await cli.run(["rollback"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe(
      "rollback requires an agent. Use `nile codex rollback`, `nile cursor rollback`, `nile claude rollback`, or `nile openclaw rollback`.",
    );
  });

  it("lists nile mutation history after apply", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "openai-official",
      label: "OpenAI Official",
      providerFamily: "openai",
      supportedAuthModes: ["api_key"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "openai-work",
        providerId: "openai-official",
        label: "OpenAI Work",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "secret-openai" },
    );
    const cli = createCli(setup);

    await cli.run(["codex", "use", "openai-work"]);
    const history = await cli.run(["history", "--json"]);

    expect(history.exitCode).toBe(0);
    expect(JSON.parse(history.stdout)).toEqual([
      expect.objectContaining({
        type: "apply_selection",
        connectionId: "openai-work",
        connectionLabel: "OpenAI Work",
        endpointLabel: "OpenAI Official",
        accessLabel: "OpenAI Work",
        status: "applied",
      }),
    ]);
  });

  it("returns usage for an openai session connection", async () => {
    const setup = createSetup({
      authFile: openAiAuthFile("work@example.com"),
    });
    const cli = createCli(setup);

    await cli.run([
      "add",
      "--preset",
      "openai",
      "--auth-mode",
      "openai_session",
      "--from-codex-current",
    ]);

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({
        plan_type: "plus",
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: {
            used_percent: 25,
            limit_window_seconds: 18000,
            reset_at: 1777433811,
          },
          secondary_window: {
            used_percent: 10,
            limit_window_seconds: 604800,
            reset_at: 1778020611,
          },
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const result = await cli.run(["usage", "work-example-com"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Connection usage");
    expect(result.stdout).toContain("connection: work@example.com");
    expect(result.stdout).toContain("endpoint: OpenAI");
    expect(result.stdout).toContain("plan: Plus");
    expect(result.stdout).toContain("5h: 75% left");
    expect(result.stdout).toContain("7d: 90% left");
  });

  it("binds cursor web usage and reads live usage for a saved cursor connection", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "cursor",
      label: "Cursor",
      providerFamily: "cursor",
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "cursor-work",
        providerId: "cursor",
        label: "cursor.user@example.com",
        authMode: "cursor_session",
      },
      {
        kind: "cursor_session",
        accessToken: "cursor-access",
        refreshToken: "cursor-refresh",
        authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
        email: "cursor.user@example.com",
      },
    );

    const cli = createCli(setup);
    const bind = await cli.run([
      "cursor",
      "usage",
      "bind",
      "cursor-work",
      "--session-token",
      CURSOR_WEB_SESSION_TOKEN,
    ]);

    expect(bind.exitCode).toBe(0);
    expect(bind.stdout).toContain("Cursor usage binding saved");
    expect(bind.stdout).toContain("connection: cursor.user@example.com");

    globalThis.fetch = (async () => new Response(JSON.stringify({
      billingCycleStart: "2026-04-01T00:00:00.000Z",
      billingCycleEnd: "2026-05-01T00:00:00.000Z",
      individualUsage: {
        plan: {
          totalPercentUsed: 12,
          autoPercentUsed: 18,
          apiPercentUsed: 2,
        },
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;

    const usage = await cli.run(["usage", "cursor-work"]);

    expect(usage.exitCode).toBe(0);
    expect(usage.stdout).toContain("Connection usage");
    expect(usage.stdout).toContain("connection: cursor.user@example.com");
    expect(usage.stdout).toContain("plan: Cursor");
    expect(usage.stdout).toContain("Total: 88% left");
    expect(usage.stdout).toContain("Auto + Composer: 82% left");
    expect(usage.stdout).toContain("API: 98% left");
  });

  it("auto-binds cursor web usage from a Chromium browser session", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "cursor",
      label: "Cursor",
      providerFamily: "cursor",
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "cursor-work",
        providerId: "cursor",
        label: "cursor.user@example.com",
        authMode: "cursor_session",
      },
      {
        kind: "cursor_session",
        accessToken: "cursor-access",
        refreshToken: "cursor-refresh",
        authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
        email: "cursor.user@example.com",
      },
    );

    const browserHome = mkdtempSync(join(tmpdir(), "nile-browser-home-"));
    tempDirs.push(browserHome);
    const cursorHome = mkdtempSync(join(tmpdir(), "nile-cursor-home-"));
    tempDirs.push(cursorHome);
    writeChromiumCursorCookies(
      join(browserHome, "Library", "Application Support", "Google", "Chrome", "Profile 1", "Cookies"),
      SAFE_STORAGE_SECRET,
    );
    process.env.NILE_BROWSER_HOME = browserHome;
    process.env.NILE_CURSOR_HOME = cursorHome;
    SecurityCli.prototype.run = function (_args: string[]): SecurityCliResult {
      return {
        exitCode: 0,
        stdout: `${SAFE_STORAGE_SECRET}\n`,
        stderr: "",
      };
    };

    const cli = createCli(setup);
    const bind = await cli.run(["cursor", "usage", "auto-bind", "cursor-work"]);

    expect(bind.exitCode).toBe(0);
    expect(bind.stdout).toContain("Cursor usage auto-bound");
    expect(bind.stdout).toContain("connection: cursor.user@example.com");
    expect(bind.stdout).toContain("source: Chrome (Profile 1)");
  });

  it("shows usage inline in the saved connections interactive view", async () => {
    const setup = createSetup({
      authFile: openAiAuthFile("work@example.com"),
    });
    await createCli(setup).run([
      "add",
      "--preset",
      "openai",
      "--auth-mode",
      "openai_session",
      "--from-codex-current",
    ]);

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({
        plan_type: "plus",
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: {
            used_percent: 25,
            limit_window_seconds: 18000,
            reset_at: 1777433811,
          },
          secondary_window: {
            used_percent: 10,
            limit_window_seconds: 604800,
            reset_at: 1778020611,
          },
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const prompt = new StubInteractivePrompt(
      [
        { type: "selected", value: "list" },
        { type: "selected", value: "back" },
        { type: "cancel" },
      ],
      [],
    );
    const cli = createCli(setup, prompt);

    const result = await cli.run([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(prompt.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Saved connections",
          message: expect.stringContaining("usage: plan Plus · 5h 75% left · 7d 90% left"),
        }),
      ]),
    );
    expect(prompt.loadingMessages).toEqual(["Fetching usage…"]);
  });

  it("rolls back the latest nile change for a scoped agent", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "openai-official",
      label: "OpenAI Official",
      providerFamily: "openai",
      supportedAuthModes: ["api_key"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "openai-work",
        providerId: "openai-official",
        label: "OpenAI Work",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "secret-openai" },
    );
    const cli = createCli(setup);

    await cli.run(["codex", "use", "openai-work"]);
    const rollback = await cli.run(["codex", "rollback"]);
    const history = await cli.run(["history", "--json"]);

    expect(rollback.exitCode).toBe(0);
    expect(rollback.stdout).toContain("Rolled back latest Nile change");
    expect(JSON.parse(readFileSync(join(setup.codexHome, "auth.json"), "utf8"))).toEqual({
      OPENAI_API_KEY: "legacy-key",
    });
    expect(JSON.parse(history.stdout)[0]).toEqual(
      expect.objectContaining({
        type: "rollback_latest",
        status: "rolled_back",
      }),
    );
  });

  it("removes a connection", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "openai",
      label: "OpenAI",
      providerFamily: "openai",
      supportedAuthModes: ["api_key", "openai_session"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "openai-work",
        providerId: "openai",
        label: "OpenAI Work",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "secret-openai" },
    );
    const cli = createCli(setup);

    const result = await cli.run(["remove", "openai-work"]);
    const list = await cli.run(["list", "--json"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Connection removed");
    expect(result.stdout).toContain("id: openai-work");
    expect(JSON.parse(list.stdout)).toEqual([]);
  });

  it("explains orphaned local selection after removing the saved connection", async () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "openai",
      label: "OpenAI",
      providerFamily: "openai",
      supportedAuthModes: ["api_key"],
    });
    seedBinding(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "openai-work",
        providerId: "openai",
        label: "OpenAI Work",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "secret-openai" },
    );
    const cli = createCli(setup);

    await cli.run(["codex", "use", "openai-work"]);
    const removal = await cli.run(["remove", "openai-work"]);
    const status = await cli.run(["status"]);

    expect(removal.exitCode).toBe(0);
    expect(removal.stdout).toContain(
      "note: Nile cleared the saved local selection for Codex because this connection was removed.",
    );
    expect(status.exitCode).toBe(0);
    expect(status.stdout).toContain("- Codex");
    expect(status.stdout).toContain("State: new connection detected");
    expect(status.stdout).toContain(
      "Hint: Current Codex setup is valid but not yet saved in Nile. Run: nile codex import",
    );
  });
});

function createSetup(options?: {
  authFile?: Record<string, unknown>;
  configToml?: string;
  cursorConfigJson?: Record<string, unknown>;
}): {
  dbPath: string;
  codexHome: string;
  cursorHome: string;
  claudeHome: string;
  openclawHome: string;
  credentialStore: StubCredentialStore;
  secureSnapshots: MemorySecureSnapshotStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-cli-"));
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
  writeFileSync(
    join(cursorHome, "cli-config.json"),
    `${JSON.stringify(options?.cursorConfigJson ?? {}, null, 2)}\n`,
    "utf8",
  );

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

function openAiAuthFile(email: string): Record<string, unknown> {
  return {
    OPENAI_API_KEY: null,
    tokens: {
      id_token: createJwt({ email }),
      access_token: "access-token",
      refresh_token: "refresh-token",
      account_id: "acct-123",
    },
    last_refresh: "2026-04-25T00:00:00.000Z",
  };
}

function createCli(
  setup: {
    dbPath: string;
    codexHome: string;
    cursorHome: string;
    claudeHome: string;
    openclawHome: string;
    credentialStore: StubCredentialStore;
    secureSnapshots: MemorySecureSnapshotStore;
  },
  prompt?: InteractivePrompt,
  loginRunner?: CodexSessionLogin,
): NileCli {
  return new NileCli(
    {
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
      prompt,
      loginRunner,
    },
    setup.credentialStore,
  );
}

function seedProvider(
  dbPath: string,
  input: {
    id: string;
    label: string;
    providerFamily: "openai" | "gateway" | "azure-openai" | "anthropic" | "cursor";
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
    providerId: string;
    label: string;
    authMode: "api_key" | "openai_session" | "claude_session" | "cursor_session";
  },
  credential: StoredCredential,
): void {
  const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
  accessRegistry.add({
    id: input.id,
    endpointId: input.providerId,
    label: input.label,
    authMode: input.authMode,
    ...(resolveIdentityKey(input.authMode, credential) ? { identityKey: resolveIdentityKey(input.authMode, credential)! } : {}),
  }, credential);
  accessRegistry.close();
}

function resolveIdentityKey(
  authMode: "api_key" | "openai_session" | "claude_session" | "cursor_session",
  credential: StoredCredential,
): string | null {
  if (authMode === "openai_session" && credential.kind === "openai_session") {
    if (credential.accountId) {
      return `account:${credential.accountId}`;
    }
    return null;
  }

  if (authMode === "claude_session" && credential.kind === "claude_session") {
    if (credential.accountUuid) {
      return `account:${credential.accountUuid}`;
    }
    return null;
  }

  if (authMode === "cursor_session" && credential.kind === "cursor_session") {
    if (credential.authId) {
      return `auth:${credential.authId}`;
    }
    return null;
  }

  return null;
}

function buildEndpointInput(input: {
  id: string;
  label: string;
  providerFamily: "openai" | "gateway" | "azure-openai" | "anthropic" | "cursor";
  connectionMetadata?: {
    baseUrl?: string;
    backendUrl?: string;
    envKey?: string;
    wireApi?: "chat" | "responses";
  };
}): EndpointRegistryInput {
  if (input.providerFamily === "cursor") {
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

  if (input.providerFamily === "anthropic") {
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
    (input.providerFamily === "azure-openai"
      ? "https://example.cognitiveservices.azure.com/openai/v1"
      : "https://api.openai.com/v1");
  const url = new URL(baseUrl);

  return {
    id: input.id,
    label: input.label,
    rootUrl: url.origin,
    profile:
      input.providerFamily === "openai"
        ? "openai-official"
        : input.providerFamily === "azure-openai"
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

function createJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown): string =>
    Buffer.from(JSON.stringify(value), "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.signature`;
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
    insertCookie(db, "cursor.com", "WorkosCursorSessionToken", encryptCookieValue(CURSOR_WEB_SESSION_JWT, safeStorageSecret));
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

class StubInteractivePrompt extends InteractivePrompt {
  readonly notes: Array<{ message: string; title?: string }> = [];
  readonly selectCalls: Array<{ message: string; labels: string[] }> = [];
  readonly multiSelectCalls: Array<{ message: string; labels: string[] }> = [];
  readonly loadingMessages: string[] = [];

  constructor(
    private readonly selections: Array<CliSelectResult<string> | CliMultiSelectResult<string>>,
    private readonly inputs: CliInputResult[],
  ) {
    super();
  }

  override isInteractive(): boolean {
    return true;
  }

  override async select<T extends string>(
    message: string,
    options: Array<{ value: T; label: string }>,
    choices?: { allowBack?: boolean; allowCancel?: boolean },
  ): Promise<CliSelectResult<T>> {
    const labels = options.map((option) => option.label);
    if (choices?.allowBack) {
      labels.push("Back");
    }
    if (choices?.allowCancel ?? true) {
      labels.push("Cancel");
    }
    this.selectCalls.push({ message, labels });

    const next = this.selections.shift();
    if (!next) {
      throw new Error("Missing stub selection");
    }
    return next as CliSelectResult<T>;
  }

  override async input(): Promise<CliInputResult> {
    const next = this.inputs.shift();
    if (!next) {
      throw new Error("Missing stub input");
    }
    return next;
  }

  override showNote(message: string, title?: string): void {
    this.notes.push({ message, title });
  }

  override async multiSelect<T extends string>(
    message: string,
    options: Array<{ value: T; label: string }>,
    choices?: { allowDone?: boolean; doneLabel?: string; allowBack?: boolean; allowCancel?: boolean },
  ): Promise<{ type: "selected"; values: T[] } | { type: "back" } | { type: "cancel" }> {
    const labels = options.map((option) => option.label);
    if (choices?.allowDone) {
      labels.push(choices.doneLabel ?? "Done");
    }
    if (choices?.allowBack) {
      labels.push("Back");
    }
    if (choices?.allowCancel ?? true) {
      labels.push("Cancel");
    }
    this.multiSelectCalls.push({ message, labels });

    const next = this.selections.shift();
    if (!next) {
      throw new Error("Missing stub selection");
    }
    if (next.type !== "selected") {
      return next;
    }
    return {
      type: "selected",
      values: "values" in next ? next.values as T[] : [next.value as T],
    };
  }

  override async withLoading<TResult>(message: string, work: () => Promise<TResult>): Promise<TResult> {
    this.loadingMessages.push(message);
    return await work();
  }
}

const SAFE_STORAGE_SECRET = "AAAAAAAAAAAAAAAAAAAAAA==";
const CURSOR_WEB_SESSION_JWT = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhdXRoMHx1c2VyXzAxSzAzSzQxQ05HUkNBRFk1VlQwSlBINjlZIiwidHlwZSI6IndlYiIsImV4cCI6NDEwMjQ0NDgwMH0.sig";
const CURSOR_WEB_SESSION_TOKEN = `user_01K03K41CNGRCADY5VT0JPH69Y::${CURSOR_WEB_SESSION_JWT}`;

class StubCodexLoginRunner extends CodexSessionLogin {
  readonly invocations: string[] = [];

  override async signIn(codexHome: string): Promise<void> {
    this.invocations.push(codexHome);
  }
}
