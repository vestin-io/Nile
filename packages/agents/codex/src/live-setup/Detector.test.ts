import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "@nile/core/models/access";
import { EndpointRegistry } from "@nile/core/models/endpoint";
import { AgentSelection } from "@nile/core/models/selection";
import { type StoredCredential } from "@nile/core/services/credential";
import { KeychainCredentialStore } from "@nile/core/services/credential";
import { LiveSetupDetector } from "./Detector";
import { CODEX_AGENT_ID } from "../types";
import type { EndpointRegistryInput } from "@nile/core/models/endpoint";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
  delete process.env.OPENAI_API_KEY3;
});

describe("LiveSetupDetector", () => {
  it("matches a known openai session connection from live state", () => {
    const setup = createSetup();
    seedEndpoint(setup.dbPath, {
      id: "openai",
      label: "OpenAI",
      rootUrl: "https://api.openai.com",
      profile: "openai-official",
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
      },
    });
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "openai-connection",
        endpointId: "openai",
        label: "primary@example.com",
        authMode: "openai_session",
        identityKey: "account:acct-123",
      },
      openAiSessionCredential(),
    );

    const agentSelection = AgentSelection.open(setup.dbPath);
    agentSelection.setApplied(CODEX_AGENT_ID, "openai-connection", "2026-04-25T00:00:00.000Z");
    agentSelection.close();

    writeFileSync(
      join(setup.codexHome, "auth.json"),
      JSON.stringify(
        {
          OPENAI_API_KEY: null,
          tokens: {
            id_token: "header.eyJlbWFpbCI6InByaW1hcnlAZXhhbXBsZS5jb20ifQ.signature",
            access_token: "access-token",
            refresh_token: "refresh-token",
            account_id: "acct-123",
          },
          last_refresh: "2026-04-25T00:00:00.000Z",
        },
        null,
        2,
      ),
      "utf8",
    );

    const detector = LiveSetupDetector.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
    });

    const result = detector.detect();

    expect(result.validity).toBe("valid_matched");
    expect(result.endpoint?.endpointFamily).toBe("openai");
    expect(result.access?.authMode).toBe("openai_session");
    expect(result.matchedConnection).toEqual({
      connectionId: "openai-connection",
      endpointId: "openai",
      accessId: "openai-connection",
      matchesAgentSelection: true,
    });

    detector.close();
  });

  it("prefers the current selected connection when multiple saved connections share the same binding", () => {
    const setup = createSetup();
    seedEndpoint(setup.dbPath, {
      id: "openai",
      label: "OpenAI",
      rootUrl: "https://api.openai.com",
      profile: "openai-official",
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
      },
    });
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "default-connection",
        endpointId: "openai",
        label: "primary@example.com",
        authMode: "openai_session",
        identityKey: "account:acct-123",
      },
      openAiSessionCredential(),
    );
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
      id: "named-connection",
        endpointId: "openai",
      label: "Work Session",
      authMode: "openai_session",
        identityKey: "account:acct-123",
      },
      openAiSessionCredential(),
    );

    const agentSelection = AgentSelection.open(setup.dbPath);
    agentSelection.setApplied(CODEX_AGENT_ID, "named-connection", "2026-04-25T00:00:00.000Z");
    agentSelection.close();

    writeFileSync(
      join(setup.codexHome, "auth.json"),
      JSON.stringify(
        {
          OPENAI_API_KEY: null,
          tokens: {
            id_token: "header.eyJlbWFpbCI6InByaW1hcnlAZXhhbXBsZS5jb20ifQ.signature",
            access_token: "access-token",
            refresh_token: "refresh-token",
            account_id: "acct-123",
          },
          last_refresh: "2026-04-25T00:00:00.000Z",
        },
        null,
        2,
      ),
      "utf8",
    );

    const detector = LiveSetupDetector.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
    });

    const result = detector.detect();

    expect(result.validity).toBe("valid_matched");
    expect(result.matchedConnection).toEqual({
      connectionId: "named-connection",
      endpointId: "openai",
      accessId: "named-connection",
      matchesAgentSelection: true,
    });

    detector.close();
  });

  it("returns an import candidate for a valid unknown azure live state", () => {
    const setup = createSetup();
    process.env.OPENAI_API_KEY3 = "azure-secret";
    writeFileSync(
      join(setup.codexHome, "config.toml"),
      [
        'model_provider = "azure"',
        "",
        "[model_providers.azure]",
        'name = "Azure"',
        'base_url = "https://example-eu-resource.cognitiveservices.azure.com/openai/v1"',
        'wire_api = "responses"',
        'env_key = "OPENAI_API_KEY3"',
        "",
      ].join("\n"),
      "utf8",
    );

    const detector = LiveSetupDetector.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
    });

    const result = detector.detect();

    expect(result.validity).toBe("valid_import_candidate");
    expect(result.endpoint?.endpointFamily).toBe("azure-openai");
    expect(result.access?.authMode).toBe("api_key");
    expect(result.matchedConnection).toBeNull();

    detector.close();
  });

  it("matches a known openai api_key connection when codex uses a custom provider id", () => {
    const setup = createSetup();
    seedEndpoint(setup.dbPath, {
      id: "openai-official",
      label: "OpenAI Official",
      rootUrl: "https://api.openai.com",
      profile: "openai-official",
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: ["responses", "chat"],
          authSchemes: ["bearer"],
          envKeyOverride: "OPENAI_API_KEY",
        },
      },
    });
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "openai-work-connection",
        endpointId: "openai-official",
        label: "OpenAI Work",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "secret-openai" },
    );
    writeFileSync(
      join(setup.codexHome, "config.toml"),
      [
        'model_provider = "openai-official"',
        "",
        "[model_providers.openai-official]",
        'name = "OpenAI Official"',
        'base_url = "https://api.openai.com/v1"',
        'wire_api = "responses"',
        'env_key = "OPENAI_API_KEY"',
        "",
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      join(setup.codexHome, "auth.json"),
      JSON.stringify({ OPENAI_API_KEY: "secret-openai" }, null, 2),
      "utf8",
    );

    const detector = LiveSetupDetector.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
    });

    const result = detector.detect();

    expect(result.validity).toBe("valid_matched");
    expect(result.endpoint?.endpointFamily).toBe("openai");
    expect(result.matchedConnection).toEqual({
      connectionId: "openai-work-connection",
      endpointId: "openai-official",
      accessId: "openai-work-connection",
      matchesAgentSelection: false,
    });

    detector.close();
  });

  it("matches through mirrored endpoint and access records when legacy provider metadata drifts", () => {
    const setup = createSetup();
    seedEndpoint(setup.dbPath, {
      id: "router",
      label: "OpenRouter",
      rootUrl: "https://openrouter.ai",
      profile: "generic-gateway",
      protocols: {
        openai: {
          basePath: "/api/v1",
          wireApis: ["responses"],
          authSchemes: ["bearer"],
          envKeyOverride: "OPENAI_API_KEY3",
        },
      },
    });
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "router-work",
        endpointId: "router",
        label: "Router Work",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "router-secret" },
    );
    process.env.OPENAI_API_KEY3 = "router-secret";
    writeFileSync(
      join(setup.codexHome, "config.toml"),
      [
        'model_provider = "router"',
        "",
        "[model_providers.router]",
        'name = "OpenRouter"',
        'base_url = "https://openrouter.ai/api/v1"',
        'wire_api = "responses"',
        'env_key = "OPENAI_API_KEY3"',
        "",
      ].join("\n"),
      "utf8",
    );

    const detector = LiveSetupDetector.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
    });

    const result = detector.detect();

    expect(result.validity).toBe("valid_matched");
    expect(result.matchedConnection).toEqual({
      connectionId: "router-work",
      endpointId: "router",
      accessId: "router-work",
      matchesAgentSelection: false,
    });

    detector.close();
  });

  it("matches a saved gateway endpoint even when the saved record has extra protocols", () => {
    const setup = createSetup();
    seedEndpoint(setup.dbPath, {
      id: "gateway-shared",
      label: "Gateway (gateway.example.test)",
      rootUrl: "https://gateway.example.test",
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
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "gateway-work",
        endpointId: "gateway-shared",
        label: "Gateway Work",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "gateway-secret" },
    );
    writeFileSync(
      join(setup.codexHome, "config.toml"),
      [
        'model_provider = "gateway-shared"',
        "",
        "[model_providers.gateway-shared]",
        'name = "Gateway (gateway.example.test)"',
        'base_url = "https://gateway.example.test/v1"',
        'wire_api = "responses"',
        'env_key = "OPENAI_API_KEY"',
        "",
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      join(setup.codexHome, "auth.json"),
      JSON.stringify({ OPENAI_API_KEY: "gateway-secret" }, null, 2),
      "utf8",
    );

    const detector = LiveSetupDetector.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
    });

    const result = detector.detect();

    expect(result.validity).toBe("valid_matched");
    expect(result.matchedConnection).toEqual({
      connectionId: "gateway-work",
      endpointId: "gateway-shared",
      accessId: "gateway-work",
      matchesAgentSelection: false,
    });

    detector.close();
  });

  it("marks env-backed provider state invalid when no readable api key exists", () => {
    const setup = createSetup();
    writeFileSync(
      join(setup.codexHome, "config.toml"),
      [
        'model_provider = "router"',
        "",
        "[model_providers.router]",
        'name = "OpenRouter"',
        'base_url = "https://openrouter.ai/api/v1"',
        'wire_api = "responses"',
        'env_key = "OPENAI_API_KEY3"',
        "",
      ].join("\n"),
      "utf8",
    );

    const detector = LiveSetupDetector.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
    });

    const result = detector.detect();

    expect(result.validity).toBe("invalid_semantics");
    expect(result.issues[0]).toContain("env key");
    expect(result.endpoint?.endpointFamily).toBe("gateway");
    expect(result.access).toBeNull();

    detector.close();
  });
});

function createSetup(): {
  dbPath: string;
  codexHome: string;
  credentialStore: StubCredentialStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-live-setup-"));
  tempDirs.push(dir);

  const codexHome = join(dir, ".codex");
  mkdirSync(codexHome, { recursive: true });
  writeFileSync(join(codexHome, "config.toml"), "", "utf8");
  writeFileSync(join(codexHome, "auth.json"), "{}\n", "utf8");

  return {
    dbPath: join(dir, "switcher.sqlite"),
    codexHome,
    credentialStore: new StubCredentialStore(),
  };
}

function seedEndpoint(dbPath: string, input: EndpointRegistryInput): void {
  const registry = EndpointRegistry.open(dbPath);
  if (!registry.get(input.id)) {
    registry.add(input);
  }
  registry.close();
}

function seedAccess(
  dbPath: string,
  credentialStore: StubCredentialStore,
  input: {
    id: string;
    endpointId: string;
    label: string;
    authMode: "api_key" | "openai_session";
    identityKey?: string;
  },
  credential: StoredCredential,
): void {
  const registry = AccessRegistry.open(dbPath, credentialStore);
  registry.add(input, credential);
  registry.close();
}

function openAiSessionCredential(): StoredCredential {
  return {
    kind: "openai_session",
    idToken: "header.eyJlbWFpbCI6ImppcWlhbmc5MEBnbWFpbC5jb20ifQ.signature",
    accessToken: "access-token",
    refreshToken: "refresh-token",
    accountId: "acct-123",
    lastRefresh: "2026-04-25T00:00:00.000Z",
  };
}

class StubCredentialStore extends KeychainCredentialStore {
  private readonly records = new Map<string, StoredCredential>();

  override create(reference: string, credential: StoredCredential): void {
    this.records.set(reference, credential);
  }

  override update(reference: string, credential: StoredCredential): void {
    this.records.set(reference, credential);
  }

  override get(reference: string): StoredCredential {
    const credential = this.records.get(reference);
    if (!credential) {
      throw new Error(`Credential not found: ${reference}`);
    }
    return credential;
  }

  override has(reference: string): boolean {
    return this.records.has(reference);
  }

  override remove(reference: string): void {
    this.records.delete(reference);
  }
}
