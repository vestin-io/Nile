import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ClaudeGatewayModelCatalog } from "../../agents/claude/GatewayModelCatalog";
import { AccessRegistry } from "../../models/access";
import { EndpointRegistry } from "../../models/endpoint";
import { EnvironmentSource } from "../../services/EnvironmentSource";
import type { CredentialStore } from "../../services/credential/Store";
import type { StoredCredential } from "../../services/credential/Types";
import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import { ConnectionModelCatalog } from "./ConnectionModelCatalog";

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
      null,
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
      null,
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

    const claudeHome = join(setup.dir, ".claude");
    mkdirSync(join(claudeHome, "cache"), { recursive: true });
    writeFileSync(join(claudeHome, "settings.json"), "{}\n", "utf8");
    writeFileSync(
      join(claudeHome, "cache", "gateway-models.json"),
      JSON.stringify({
        baseUrl: "https://gateway.example.test/v1",
        models: [{ id: "claude-sonnet-4-5" }, { id: "claude-opus-4-1" }],
      }, null, 2),
      "utf8",
    );

    const catalog = new ConnectionModelCatalog(
      setup.endpointRegistry,
      setup.accessRegistry,
      EnvironmentSource.empty(),
      new ClaudeGatewayModelCatalog(join(claudeHome, "settings.json")),
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

    const claudeHome = join(setup.dir, ".claude");
    mkdirSync(join(claudeHome, "cache"), { recursive: true });
    writeFileSync(join(claudeHome, "settings.json"), "{}\n", "utf8");
    writeFileSync(
      join(claudeHome, "cache", "gateway-models.json"),
      JSON.stringify({
        baseUrl: "https://gateway.example.test/v1",
        models: [{ id: "claude-sonnet-4-5" }, { id: "claude-opus-4-1" }],
      }, null, 2),
      "utf8",
    );

    const requests: string[] = [];
    const catalog = new ConnectionModelCatalog(
      setup.endpointRegistry,
      setup.accessRegistry,
      EnvironmentSource.empty(),
      new ClaudeGatewayModelCatalog(join(claudeHome, "settings.json")),
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
