import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "@nile/core/models/access";
import { EndpointRegistry, type EndpointRegistryInput } from "@nile/core/models/endpoint";
import { type StoredCredential } from "@nile/core/services/credential";
import { KeychainCredentialStore } from "@nile/core/services/credential";
import { SecureSnapshotStore } from "@nile/core/services/history";
import { AgentSelection } from "@nile/core/models/selection";
import { ApplySelection, ApplySelectionValidationError } from "./ApplySelection";
import { CODEX_AGENT_ID } from "../types";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("ApplySelection", () => {
  it("applies openai api_key accounts into auth.json and config.toml", () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "openai-official",
      label: "OpenAI Official",
      endpointFamily: "openai",
      supportedAuthModes: ["openai_session", "api_key"],
    });
    seedAccess(setup.dbPath, setup.credentialStore, {
      id: "openai-work",
      endpointId: "openai-official",
      label: "OpenAI Work",
      authMode: "api_key",
    }, { kind: "api_key", apiKey: "secret-openai" });
    seedConnection(setup.dbPath, setup.credentialStore, {
      id: "openai-work-connection",
      endpointId: "openai-official",
      accessId: "openai-work",
      label: "OpenAI Work",
      authMode: "api_key",
    });

    const applySelection = ApplySelection.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });

    const result = applySelection.apply("openai-work-connection");

    expect(result.connectionId).toBe("openai-work-connection");
    expect(result.endpointId).toBe("openai-official");
    expect(result.accessId).toBe("openai-work-connection");
    expect(readAuth(setup.codexHome)).toEqual({
      OPENAI_API_KEY: "secret-openai",
    });
    expect(readConfig(setup.codexHome)).toContain('model_provider = "openai-official"');
    expect(readConfig(setup.codexHome)).toContain('[model_providers.openai-official]');
    expect(readConfig(setup.codexHome)).not.toContain('env_key = "OPENAI_API_KEY"');
    expectCodexAgentSelection(setup.dbPath, {
      connectionId: "openai-work-connection",
      endpointId: "openai-official",
      accessId: "openai-work-connection",
    });

    applySelection.close();
  });

  it("applies openai session accounts with token bundles", () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "openai-chatgpt",
      label: "OpenAI ChatGPT",
      endpointFamily: "openai",
      supportedAuthModes: ["openai_session"],
    });
    seedAccess(setup.dbPath, setup.credentialStore, {
      id: "chatgpt-work",
      endpointId: "openai-chatgpt",
      label: "ChatGPT Work",
      authMode: "openai_session",
    }, openAiSessionCredential());
    seedConnection(setup.dbPath, setup.credentialStore, {
      id: "chatgpt-work-connection",
      endpointId: "openai-chatgpt",
      accessId: "chatgpt-work",
      label: "ChatGPT Work",
      authMode: "openai_session",
    });

    const applySelection = ApplySelection.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });

    applySelection.apply("chatgpt-work-connection");

    expect(readAuth(setup.codexHome)).toEqual({
      OPENAI_API_KEY: null,
      tokens: {
        id_token: "id-token",
        access_token: "access-token",
        refresh_token: "refresh-token",
        account_id: "acct-123",
      },
      last_refresh: "2026-04-25T00:00:00.000Z",
    });
    expect(readConfig(setup.codexHome)).not.toContain('env_key = "OPENAI_API_KEY"');

    applySelection.close();
  });

  it("uses the Codex built-in openai provider without overriding it", () => {
    const setup = createSetup();
    writeFileSync(
      join(setup.codexHome, "config.toml"),
      [
        'model = "gpt-5.4"',
        'model_provider = "legacy"',
        "",
        "# BEGIN nile-switcher managed endpoint",
        "[model_providers.openai]",
        'name = "OpenAI"',
        'base_url = "https://api.openai.com/v1"',
        'wire_api = "responses"',
        "# END nile-switcher managed endpoint",
        "",
      ].join("\n"),
      "utf8",
    );
    seedProvider(setup.dbPath, {
      id: "openai",
      label: "OpenAI",
      endpointFamily: "openai",
      supportedAuthModes: ["openai_session", "api_key"],
    });
    seedAccess(setup.dbPath, setup.credentialStore, {
      id: "chatgpt-work",
      endpointId: "openai",
      label: "ChatGPT Work",
      authMode: "openai_session",
    }, openAiSessionCredential());
    seedConnection(setup.dbPath, setup.credentialStore, {
      id: "chatgpt-work-connection",
      endpointId: "openai",
      accessId: "chatgpt-work",
      label: "ChatGPT Work",
      authMode: "openai_session",
    });

    const applySelection = ApplySelection.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });

    applySelection.apply("chatgpt-work-connection");

    const config = readConfig(setup.codexHome);
    expect(config).toContain('model_provider = "openai"');
    expect(config).not.toContain("[model_providers.openai]");
    expect(config).not.toContain("BEGIN nile-switcher managed endpoint");

    applySelection.close();
  });

  it("applies gateway api_key providers with explicit base_url", () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "router",
      label: "OpenRouter",
      endpointFamily: "gateway",
      supportedAuthModes: ["api_key"],
      connectionMetadata: {
        baseUrl: "https://router.example/v1",
        wireApi: "responses",
      },
    });
    seedAccess(setup.dbPath, setup.credentialStore, {
      id: "router-work",
      endpointId: "router",
      label: "Router Work",
      authMode: "api_key",
    }, { kind: "api_key", apiKey: "router-secret" });
    seedConnection(setup.dbPath, setup.credentialStore, {
      id: "router-work-connection",
      endpointId: "router",
      accessId: "router-work",
      label: "Router Work",
      authMode: "api_key",
    });

    const applySelection = ApplySelection.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });

    applySelection.apply("router-work-connection");

    const config = readConfig(setup.codexHome);
    expect(config).toContain('base_url = "https://router.example/v1"');
    expect(config).not.toContain('env_key = "OPENAI_API_KEY"');

    applySelection.close();
  });

  it("applies azure-openai api_key providers with the azure path", () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "azure-work",
      label: "Azure Work",
      endpointFamily: "azure-openai",
      supportedAuthModes: ["api_key"],
      connectionMetadata: {
        baseUrl: "https://example.cognitiveservices.azure.com/openai/v1",
        wireApi: "responses",
      },
    });
    seedAccess(setup.dbPath, setup.credentialStore, {
      id: "azure-account",
      endpointId: "azure-work",
      label: "Azure Account",
      authMode: "api_key",
    }, { kind: "api_key", apiKey: "azure-secret" });
    seedConnection(setup.dbPath, setup.credentialStore, {
      id: "azure-account-connection",
      endpointId: "azure-work",
      accessId: "azure-account",
      label: "Azure Account",
      authMode: "api_key",
    });

    const applySelection = ApplySelection.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });

    applySelection.apply("azure-account-connection");

    const config = readConfig(setup.codexHome);
    expect(config).toContain('model_provider = "azure-work"');
    expect(config).toContain('base_url = "https://example.cognitiveservices.azure.com/openai/v1"');
    expect(config).not.toContain('env_key = "OPENAI_API_KEY"');

    applySelection.close();
  });

  it("does not force env keys for direct azure-openai api_key providers", () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "azure-work",
      label: "Azure Work",
      endpointFamily: "azure-openai",
      supportedAuthModes: ["api_key"],
      connectionMetadata: {
        baseUrl: "https://example.cognitiveservices.azure.com/openai/v1",
        envKey: "OPENAI_API_KEY3",
      },
    });
    seedAccess(setup.dbPath, setup.credentialStore, {
      id: "azure-account",
      endpointId: "azure-work",
      label: "Azure Account",
      authMode: "api_key",
    }, { kind: "api_key", apiKey: "azure-secret" });
    seedConnection(setup.dbPath, setup.credentialStore, {
      id: "azure-account-connection",
      endpointId: "azure-work",
      accessId: "azure-account",
      label: "Azure Account",
      authMode: "api_key",
    });

    const applySelection = ApplySelection.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });

    applySelection.apply("azure-account-connection");

    const config = readConfig(setup.codexHome);
    expect(config).not.toContain('env_key = "OPENAI_API_KEY3"');
    expect(config).not.toContain('env_key = "OPENAI_API_KEY"\n');

    applySelection.close();
  });

  it("uses an existing env key without writing the API key into auth.json", () => {
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
    seedAccess(setup.dbPath, setup.credentialStore, {
      id: "azure-account",
      endpointId: "azure-work",
      label: "Azure Account",
      authMode: "api_key",
    }, {
      kind: "api_key",
      source: "env_key",
      envKey: "OPENAI_API_KEY_WORK",
    });
    seedConnection(setup.dbPath, setup.credentialStore, {
      id: "azure-account-connection",
      endpointId: "azure-work",
      accessId: "azure-account",
      label: "Azure Account",
      authMode: "api_key",
    });

    const applySelection = ApplySelection.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });

    applySelection.apply("azure-account-connection");

    expect(readAuth(setup.codexHome)).toEqual({
      OPENAI_API_KEY: null,
    });
    expect(readConfig(setup.codexHome)).toContain('env_key = "OPENAI_API_KEY_WORK"');

    applySelection.close();
  });

  it("replaces an existing provider block instead of creating duplicate model_providers sections", () => {
    const setup = createSetup();
    writeFileSync(
      join(setup.codexHome, "config.toml"),
      [
        'model = "gpt-5.4"',
        'model_provider = "azure"',
        "",
        "[model_providers.azure]",
        'name = "Legacy Azure"',
        'base_url = "https://legacy.cognitiveservices.azure.com/openai/v1"',
        'wire_api = "responses"',
        'env_key = "OPENAI_API_KEY3"',
        "",
      ].join("\n"),
      "utf8",
    );
    seedProvider(setup.dbPath, {
      id: "azure",
      label: "Azure OpenAI (example-eu-resource.cognitiveservices.azure.com)",
      endpointFamily: "azure-openai",
      supportedAuthModes: ["api_key"],
      connectionMetadata: {
        baseUrl: "https://example-eu-resource.cognitiveservices.azure.com/openai/v1",
        wireApi: "responses",
      },
    });
    seedAccess(setup.dbPath, setup.credentialStore, {
      id: "azure-account",
      endpointId: "azure",
      label: "Azure Account",
      authMode: "api_key",
    }, { kind: "api_key", apiKey: "azure-secret" });
    seedConnection(setup.dbPath, setup.credentialStore, {
      id: "azure-account-connection",
      endpointId: "azure",
      accessId: "azure-account",
      label: "Azure Account",
      authMode: "api_key",
    });

    const applySelection = ApplySelection.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });

    applySelection.apply("azure-account-connection");

    const config = readConfig(setup.codexHome);
    expect((config.match(/\[model_providers\.azure\]/g) ?? []).length).toBe(1);
    expect(config).toContain('base_url = "https://example-eu-resource.cognitiveservices.azure.com/openai/v1"');
    expect(config).not.toContain('base_url = "https://legacy.cognitiveservices.azure.com/openai/v1"');

    applySelection.close();
  });

  it("fails before mutation when provider metadata is incomplete and keeps the previous selection", () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "openai-official",
      label: "OpenAI Official",
      endpointFamily: "openai",
      supportedAuthModes: ["api_key"],
    });
    seedAccess(setup.dbPath, setup.credentialStore, {
      id: "openai-work",
      endpointId: "openai-official",
      label: "OpenAI Work",
      authMode: "api_key",
    }, { kind: "api_key", apiKey: "secret-openai" });
    seedConnection(setup.dbPath, setup.credentialStore, {
      id: "openai-work-connection",
      endpointId: "openai-official",
      accessId: "openai-work",
      label: "OpenAI Work",
      authMode: "api_key",
    });

    const endpointRegistry = EndpointRegistry.open(setup.dbPath);
    endpointRegistry.add({
      id: "azure-invalid",
      label: "Azure Invalid",
      rootUrl: "https://invalid.example",
      profile: "generic-gateway",
      protocols: {
        anthropic: {
          authSchemes: ["x_api_key"],
          envKeyOverride: "ANTHROPIC_API_KEY",
          versionHeader: "2023-06-01",
        },
      },
    });
    endpointRegistry.close();

    const accessRegistry = AccessRegistry.open(setup.dbPath, setup.credentialStore);
    accessRegistry.add({
      id: "azure-chatgpt-connection",
      endpointId: "azure-invalid",
      label: "Azure ChatGPT",
      authMode: "openai_session",
    }, openAiSessionCredential());
    accessRegistry.close();

    const applySelection = ApplySelection.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });

    applySelection.apply("openai-work-connection");
    const beforeAuth = readFileSync(join(setup.codexHome, "auth.json"), "utf8");
    const beforeConfig = readFileSync(join(setup.codexHome, "config.toml"), "utf8");

    expect(() => applySelection.apply("azure-chatgpt-connection")).toThrow(ApplySelectionValidationError);

    expect(readFileSync(join(setup.codexHome, "auth.json"), "utf8")).toBe(beforeAuth);
    expect(readFileSync(join(setup.codexHome, "config.toml"), "utf8")).toBe(beforeConfig);
    expectCodexAgentSelection(setup.dbPath, {
      connectionId: "openai-work-connection",
      endpointId: "openai-official",
      accessId: "openai-work-connection",
    });

    applySelection.close();
  });
});

function createSetup(): {
  dbPath: string;
  codexHome: string;
  credentialStore: StubCredentialStore;
  secureSnapshots: MemorySecureSnapshotStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-apply-selection-"));
  tempDirs.push(dir);

  const codexHome = join(dir, ".codex");
  mkdirSync(codexHome, { recursive: true });

  const configPath = join(codexHome, "config.toml");
  const authPath = join(codexHome, "auth.json");
  writeFileSync(
    configPath,
    `model = "gpt-5.4"\nmodel_provider = "legacy"\n[projects."/Users/example"]\ntrust_level = "trusted"\n`,
    "utf8",
  );
  writeFileSync(authPath, '{\n  "OPENAI_API_KEY": "legacy-key"\n}\n', "utf8");

  return {
    dbPath: join(dir, "switcher.sqlite"),
    codexHome,
    credentialStore: new StubCredentialStore(),
    secureSnapshots: new MemorySecureSnapshotStore(),
  };
}

function seedProvider(
  dbPath: string,
  input: {
    id: string;
    label: string;
    endpointFamily: "openai" | "gateway" | "azure-openai";
    supportedAuthModes?: Array<"api_key" | "openai_session">;
    agentCompatibility?: Array<"codex" | "claude" | "cursor">;
    connectionMetadata?: {
      baseUrl?: string;
      envKey?: string;
      wireApi?: "chat" | "responses";
    };
  },
): void {
  const endpointRegistry = EndpointRegistry.open(dbPath);
  endpointRegistry.add(buildEndpointInput(input));
  endpointRegistry.close();
}

function seedAccess(
  _dbPath: string,
  credentialStore: StubCredentialStore,
  input: {
    id: string;
    endpointId: string;
    label: string;
    authMode: "api_key" | "openai_session";
  },
  credential: StoredCredential,
): void {
  credentialStore.create(`access:${input.id}`, credential);
}

function expectCodexAgentSelection(
  dbPath: string,
  expected: { connectionId: string; endpointId: string; accessId: string },
): void {
  const selection = AgentSelection.open(dbPath);
  expect(selection.get(CODEX_AGENT_ID)).toEqual({
    agentId: CODEX_AGENT_ID,
    connectionId: expected.connectionId,
    endpointId: expected.endpointId,
    accessId: expected.accessId,
    appliedAt: expect.any(String),
  });
  selection.close();
}

function seedConnection(
  dbPath: string,
  credentialStore: StubCredentialStore,
  input: {
    id: string;
    endpointId: string;
    accessId: string;
    label: string;
    authMode: "api_key" | "openai_session";
  },
): void {
  const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
  accessRegistry.add(
    {
      id: input.id,
      endpointId: input.endpointId,
      label: input.label,
      authMode: input.authMode,
    },
    credentialStore.get(`access:${input.accessId}`),
  );
  accessRegistry.close();
}

function buildEndpointInput(input: {
  id: string;
  label: string;
  endpointFamily: "openai" | "gateway" | "azure-openai";
  connectionMetadata?: {
    baseUrl?: string;
    envKey?: string;
    wireApi?: "chat" | "responses";
  };
}): EndpointRegistryInput {
  if (input.endpointFamily === "openai") {
    return {
      id: input.id,
      label: input.label,
      rootUrl: "https://api.openai.com",
      profile: "openai-official" as const,
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: [input.connectionMetadata?.wireApi ?? "responses"],
          authSchemes: ["bearer"] as Array<"bearer">,
          envKeyOverride: input.connectionMetadata?.envKey ?? "OPENAI_API_KEY",
        },
      },
    };
  }

  const baseUrl =
    input.connectionMetadata?.baseUrl ??
    (input.endpointFamily === "azure-openai"
      ? "https://example.cognitiveservices.azure.com/openai/v1"
      : "https://gateway.example/v1");
  const url = new URL(baseUrl);
  const basePath = url.pathname === "/" ? "/v1" : url.pathname.replace(/\/+$/, "");

  return {
    id: input.id,
    label: input.label,
    rootUrl: url.origin,
    profile: input.endpointFamily === "azure-openai" ? "azure-openai" as const : "generic-gateway" as const,
    protocols: {
      openai: {
        basePath,
        wireApis: [input.connectionMetadata?.wireApi ?? "responses"],
        authSchemes: ["bearer"] as Array<"bearer">,
        envKeyOverride: input.connectionMetadata?.envKey ?? "OPENAI_API_KEY",
      },
    },
  };
}

function readAuth(codexHome: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(codexHome, "auth.json"), "utf8")) as Record<string, unknown>;
}

function readConfig(codexHome: string): string {
  return readFileSync(join(codexHome, "config.toml"), "utf8");
}

function openAiSessionCredential(): StoredCredential {
  return {
    kind: "openai_session",
    idToken: "id-token",
    accessToken: "access-token",
    refreshToken: "refresh-token",
    accountId: "acct-123",
    lastRefresh: "2026-04-25T00:00:00.000Z",
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
