import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AccessRegistry } from "@nile/core/models/access";
import { EndpointRegistry, type EndpointRecord } from "@nile/core/models/endpoint";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import type { CredentialStore, StoredCredential } from "@nile/core/services/credential";
import { SqliteDatabase } from "@nile/core/services/database";
import type { LocalModelCatalogSource } from "@nile/core/application/local/model-catalog-source";
import { ConnectionModelCatalog } from "./Catalog";

const tempDirs: string[] = [];

describe("ConnectionModelCatalog", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
  });

  it("reads models for an OpenAI session connection", async () => {
    const setup = createSetup();
    setup.endpointRegistry.add({
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
    setup.accessRegistry.add({
      id: "work-session",
      endpointId: "openai",
      label: "Work",
      authMode: "openai_session",
      enabledAgents: ["codex"],
    }, {
      kind: "openai_session",
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accountId: "acct-123",
    });

    const requests: Array<{ url: string; authorization: string | null; accountId: string | null }> = [];
    const catalog = new ConnectionModelCatalog(
      setup.endpointRegistry,
      setup.accessRegistry,
      EnvironmentSource.empty(),
      [],
      async (input, init) => {
        requests.push({
          url: input instanceof Request ? input.url : String(input),
          authorization: readHeader(init, "authorization"),
          accountId: readHeader(init, "chatgpt-account-id"),
        });
        return new Response(JSON.stringify({
          models: [
            { slug: "gpt-5.4" },
            { slug: "gpt-5.3-codex" },
          ],
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );

    await expect(catalog.read("work-session")).resolves.toEqual({
      connectionId: "work-session",
      status: "available",
      models: ["gpt-5.4", "gpt-5.3-codex"],
    });
    expect(requests).toEqual([{
      url: "https://chatgpt.com/backend-api/codex/models?client_version=1.0.0",
      authorization: "Bearer access-token",
      accountId: "acct-123",
    }]);

    setup.database.close();
  });

  it("reads models for an env-backed API key connection", async () => {
    const setup = createSetup();
    setup.endpointRegistry.add({
      id: "gateway",
      label: "Gateway",
      rootUrl: "https://gateway.example.test",
      profile: "generic-gateway",
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
      },
    });
    setup.accessRegistry.add({
      id: "gateway-key",
      endpointId: "gateway",
      label: "Gateway key",
      authMode: "api_key",
      enabledAgents: ["codex"],
    }, {
      kind: "api_key",
      source: "env_key",
      envKey: "TEST_GATEWAY_KEY",
    });

    const catalog = new ConnectionModelCatalog(
      setup.endpointRegistry,
      setup.accessRegistry,
      EnvironmentSource.from({ TEST_GATEWAY_KEY: "env-secret" }),
      [],
      async (_input, init) => {
        expect(readHeader(init, "authorization")).toBe("Bearer env-secret");
        return new Response(JSON.stringify({
          data: [
            { id: "gpt-4.1" },
          ],
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );

    await expect(catalog.read("gateway-key")).resolves.toEqual({
      connectionId: "gateway-key",
      status: "available",
      models: ["gpt-4.1"],
    });

    setup.database.close();
  });

  it("reads models for an anthropic gateway connection from the Claude gateway cache", async () => {
    const setup = createSetup();
    setup.endpointRegistry.add({
      id: "gateway",
      label: "Gateway",
      rootUrl: "https://gateway.example.test",
      profile: "generic-gateway",
      protocols: {
        anthropic: {
          basePath: "/v1",
          authSchemes: ["x_api_key"],
          envKeyOverride: "ANTHROPIC_API_KEY",
          versionHeader: "2023-06-01",
        },
      },
    });
    setup.accessRegistry.add({
      id: "gateway-key",
      endpointId: "gateway",
      label: "Gateway key",
      authMode: "api_key",
      enabledAgents: ["claude", "openclaw"],
    }, {
      kind: "api_key",
      source: "direct",
      apiKey: "secret",
    });

    const catalog = new ConnectionModelCatalog(
      setup.endpointRegistry,
      setup.accessRegistry,
      EnvironmentSource.empty(),
      [new StubLocalModelCatalogSource({
        "https://gateway.example.test/v1": ["claude-sonnet-4-5", "claude-opus-4-1"],
      })],
    );

    await expect(catalog.read("gateway-key")).resolves.toEqual({
      connectionId: "gateway-key",
      status: "available",
      models: ["claude-sonnet-4-5", "claude-opus-4-1"],
    });

    setup.database.close();
  });

  it("merges Claude gateway cache models with live OpenAI-compatible models for a generic gateway", async () => {
    const setup = createSetup();
    setup.endpointRegistry.add({
      id: "gateway",
      label: "Gateway",
      rootUrl: "https://gateway.example.test",
      profile: "generic-gateway",
      protocols: {
        anthropic: {
          basePath: "/v1",
          authSchemes: ["x_api_key"],
          envKeyOverride: "ANTHROPIC_API_KEY",
          versionHeader: "2023-06-01",
        },
      },
    });
    setup.accessRegistry.add({
      id: "gateway-key",
      endpointId: "gateway",
      label: "Gateway key",
      authMode: "api_key",
      enabledAgents: ["claude", "openclaw"],
    }, {
      kind: "api_key",
      source: "direct",
      apiKey: "secret",
    });

    const requests: string[] = [];
    const catalog = new ConnectionModelCatalog(
      setup.endpointRegistry,
      setup.accessRegistry,
      EnvironmentSource.empty(),
      [new StubLocalModelCatalogSource({
        "https://gateway.example.test/v1": ["claude-sonnet-4-5", "claude-opus-4-1"],
      })],
      async (input) => {
        requests.push(input instanceof Request ? input.url : String(input));
        return new Response(JSON.stringify({
          data: [
            { id: "gpt-5.4" },
            { id: "gpt-5.3-codex" },
          ],
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );

    await expect(catalog.read("gateway-key")).resolves.toEqual({
      connectionId: "gateway-key",
      status: "available",
      models: ["gpt-5.4", "gpt-5.3-codex", "claude-sonnet-4-5", "claude-opus-4-1"],
    });
    expect(requests).toEqual(["https://gateway.example.test/v1/models"]);

    setup.database.close();
  });

  it("reads Gemini models for a Gemini CLI session connection", async () => {
    const setup = createSetup();
    setup.endpointRegistry.add({
      id: "gemini",
      label: "Gemini",
      rootUrl: "https://generativelanguage.googleapis.com",
      profile: "gemini-cli",
      protocols: {
        gemini: {
          authTypes: ["oauth-personal"],
        },
      },
    });
    setup.accessRegistry.add({
      id: "gemini-session",
      endpointId: "gemini",
      label: "Gemini session",
      authMode: "gemini_cli_session",
      enabledAgents: ["gemini"],
    }, {
      kind: "gemini_cli_session",
      accessToken: "gemini-access-token",
      refreshToken: "gemini-refresh-token",
      idToken: "gemini-id-token",
    });

    const requests: string[] = [];
    const catalog = new ConnectionModelCatalog(
      setup.endpointRegistry,
      setup.accessRegistry,
      EnvironmentSource.empty(),
      [],
      async (input) => {
        const url = input instanceof Request ? input.url : String(input);
        requests.push(url);
        if (url === "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist") {
          return new Response(JSON.stringify({
            cloudaicompanionProject: "alien-superstate-rq4hk",
          }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url === "https://cloudcode-pa.googleapis.com/v1internal:listExperiments") {
          return new Response(JSON.stringify({
            flags: [
              { flagId: 45768879, boolValue: true },
              { flagId: 45760185, boolValue: true },
              { flagId: 45771641, boolValue: true },
            ],
            experimentIds: [],
          }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url === "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota") {
          return new Response(JSON.stringify({
            buckets: [
              { modelId: "gemini-3-flash-preview" },
              { modelId: "gemini-3.1-flash-lite-preview" },
              { modelId: "gemini-2.5-pro" },
            ],
          }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        throw new Error(`Unexpected request: ${url}`);
      },
    );

    await expect(catalog.read("gemini-session")).resolves.toEqual({
      connectionId: "gemini-session",
      status: "available",
      models: [
        "gemini-3-flash-preview",
        "gemini-3.1-flash-lite-preview",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemma-4-31b-it",
        "gemma-4-26b-a4b-it",
      ],
    });
    expect(requests).toEqual([
      "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist",
      "https://cloudcode-pa.googleapis.com/v1internal:listExperiments",
      "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota",
    ]);

    setup.database.close();
  });

  it("does not advertise Gemini Pro models when preview access exists but experiments are unavailable", async () => {
    const setup = createSetup();
    setup.endpointRegistry.add({
      id: "gemini",
      label: "Gemini",
      rootUrl: "https://generativelanguage.googleapis.com",
      profile: "gemini-cli",
      protocols: {
        gemini: {
          authTypes: ["oauth-personal"],
        },
      },
    });
    setup.accessRegistry.add({
      id: "gemini-session",
      endpointId: "gemini",
      label: "Gemini session",
      authMode: "gemini_cli_session",
      enabledAgents: ["gemini"],
    }, {
      kind: "gemini_cli_session",
      accessToken: "gemini-access-token",
      refreshToken: "gemini-refresh-token",
      idToken: "gemini-id-token",
    });

    const catalog = new ConnectionModelCatalog(
      setup.endpointRegistry,
      setup.accessRegistry,
      EnvironmentSource.empty(),
      [],
      async (input) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url === "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist") {
          return new Response(JSON.stringify({
            cloudaicompanionProject: { id: "alien-superstate-rq4hk" },
          }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url === "https://cloudcode-pa.googleapis.com/v1internal:listExperiments") {
          return new Response(null, { status: 500 });
        }
        if (url === "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota") {
          return new Response(JSON.stringify({
            buckets: [
              { modelId: "gemini-3-flash-preview" },
              { modelId: "gemini-3.1-flash-lite-preview" },
            ],
          }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        throw new Error(`Unexpected request: ${url}`);
      },
    );

    await expect(catalog.read("gemini-session")).resolves.toEqual({
      connectionId: "gemini-session",
      status: "available",
      models: [
        "gemini-3-flash-preview",
        "gemini-3.1-flash-lite-preview",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemma-4-31b-it",
        "gemma-4-26b-a4b-it",
      ],
    });

    setup.database.close();
  });
});

function createSetup() {
  const dir = mkdtempSync(join(tmpdir(), "nile-connection-model-catalog-"));
  tempDirs.push(dir);
  const database = SqliteDatabase.open(join(dir, "switcher.sqlite"));
  const credentialStore = new MemoryCredentialStore();
  return {
    dir,
    database,
    endpointRegistry: EndpointRegistry.fromDatabase(database),
    accessRegistry: AccessRegistry.fromDatabase(database, credentialStore),
  };
}

class StubLocalModelCatalogSource implements LocalModelCatalogSource {
  constructor(private readonly modelsByBaseUrl: Record<string, string[]>) {}

  readModels(endpoint: EndpointRecord): string[] {
    const candidateBaseUrls = [
      endpoint.protocols.anthropic
        ? `${endpoint.rootUrl}${endpoint.protocols.anthropic.basePath ?? ""}`.replace(/\/+$/, "")
        : null,
      endpoint.protocols.openai
        ? `${endpoint.rootUrl}${endpoint.protocols.openai.basePath ?? ""}`.replace(/\/+$/, "")
        : null,
    ].filter((value): value is string => Boolean(value));

    const seen = new Set<string>();
    const models: string[] = [];
    for (const baseUrl of candidateBaseUrls) {
      for (const modelId of this.modelsByBaseUrl[baseUrl] ?? []) {
        const normalized = modelId.trim();
        if (!normalized || seen.has(normalized)) {
          continue;
        }
        seen.add(normalized);
        models.push(normalized);
      }
    }
    return models;
  }
}

function readHeader(init: RequestInit | undefined, key: string): string | null {
  const headers = new Headers(init?.headers);
  return headers.get(key);
}

class MemoryCredentialStore implements CredentialStore {
  private readonly values = new Map<string, StoredCredential>();

  create(credentialId: string, credential: StoredCredential): void {
    this.values.set(credentialId, credential);
  }

  update(credentialId: string, credential: StoredCredential): void {
    this.values.set(credentialId, credential);
  }

  get(credentialId: string): StoredCredential {
    const value = this.values.get(credentialId);
    if (!value) {
      throw new Error(`Missing credential: ${credentialId}`);
    }
    return value;
  }

  has(credentialId: string): boolean {
    return this.values.has(credentialId);
  }

  remove(credentialId: string): void {
    this.values.delete(credentialId);
  }
}
