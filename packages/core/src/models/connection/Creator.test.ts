import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { StoredCredential } from "../../services/credential/Types";
import { KeychainCredentialStore } from "../../services/credential/KeychainCredentialStore";
import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import { AccessRegistry } from "../access";
import type { AccessRecord } from "../access";
import { SqliteAccessStore } from "../access/SqliteAccessStore";
import { EndpointRegistry } from "../endpoint";
import { ConnectionCreator } from "./Creator";
import type { GatewayProbeResult } from "./setup/GatewayProbe";

const tempRoots: string[] = [];

describe("ConnectionCreator", () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      rmSync(tempRoots.pop()!, { recursive: true, force: true });
    }
  });

  test("preserves pending access state when access insert fails after the row is written", async () => {
    const dbPath = createTempDatabasePath();
    const database = SqliteDatabase.open(dbPath);
    const credentialStore = new StubCredentialStore();
    const endpointRegistry = EndpointRegistry.fromDatabase(database);
    const accessRegistry = new AccessRegistry(
      new ThrowingAccessStore(database),
      credentialStore,
      endpointRegistry,
      new StaticCredentialSourceFactory(),
      null,
    );
    const creator = new ConnectionCreator(
      endpointRegistry,
      accessRegistry,
    );

    try {
      await expect(creator.create({
        preset: "openai",
        authMode: "api_key",
        label: "Work Key",
        credential: {
          kind: "api_key",
          apiKey: "secret",
        },
      })).rejects.toThrow("Injected connection insert failure");

      expect(endpointRegistry.list()).toEqual([
        expect.objectContaining({
          id: "openai",
        }),
      ]);
      expect(accessRegistry.list()).toEqual([
        expect.objectContaining({
          id: "work-key",
          credentialSyncState: "pending_write",
        }),
      ]);
      expect(credentialStore.has("access:work-key")).toBe(false);
    } finally {
      database.close();
    }
  });

  test("creates endpoint and access records from the new connection shape", async () => {
    const dbPath = createTempDatabasePath();
    const database = SqliteDatabase.open(dbPath);
    const credentialStore = new StubCredentialStore();
    const endpointRegistry = EndpointRegistry.fromDatabase(database);
    const accessRegistry = AccessRegistry.fromDatabase(
      database,
      credentialStore,
      new StaticCredentialSourceFactory(),
    );
    const creator = new ConnectionCreator(
      endpointRegistry,
      accessRegistry,
    );

    try {
      const result = await creator.create({
        preset: "azure-openai",
        authMode: "api_key",
        endpointUrl: "https://example.cognitiveservices.azure.com/openai/v1",
        label: "Azure Team",
        credential: {
          kind: "api_key",
          apiKey: "secret",
        },
      });

      const endpoint = endpointRegistry.list()[0];
      const access = accessRegistry.get("azure-team");

      expect(endpoint).toEqual({
        id: "azure-openai-example-cognitiveservices-azure-com",
        label: "Azure OpenAI (example)",
        rootUrl: "https://example.cognitiveservices.azure.com",
        profile: "azure-openai",
        protocols: {
          openai: {
            basePath: "/openai/v1",
            wireApis: ["responses"],
            authSchemes: ["bearer"],
            envKeyOverride: "OPENAI_API_KEY",
          },
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(access).toEqual({
        id: "azure-team",
        endpointId: result.endpointId,
        label: "Azure Team",
        authMode: "api_key",
        apiKeySource: "direct",
        enabledAgents: ["codex"],
        credentialSource: {
          kind: "local",
          reference: "access:azure-team",
          scope: "access",
          allowLocalMaterialization: true,
        },
        credentialSyncState: "ready",
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(credentialStore.get("access:azure-team")).toEqual({
        kind: "api_key",
        apiKey: "secret",
      });
    } finally {
      database.close();
    }
  });

  test("stores gateway endpoints with every detected supported protocol", async () => {
    const dbPath = createTempDatabasePath();
    const database = SqliteDatabase.open(dbPath);
    const credentialStore = new StubCredentialStore();
    const endpointRegistry = EndpointRegistry.fromDatabase(database);
    const accessRegistry = AccessRegistry.fromDatabase(
      database,
      credentialStore,
      new StaticCredentialSourceFactory(),
    );
    const creator = new ConnectionCreator(
      endpointRegistry,
      accessRegistry,
      new StubGatewayProbe({
        openai: {
          basePath: "/v1",
          wireApis: ["responses", "chat"],
          authSchemes: ["bearer"],
          envKeyOverride: "OPENAI_API_KEY",
        },
        anthropic: {
          authSchemes: ["bearer"],
          envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
          versionHeader: "2023-06-01",
        },
      }),
    );

    try {
      const result = await creator.create({
        preset: "gateway",
        authMode: "api_key",
        endpointUrl: "https://gateway.example.test",
        credential: {
          kind: "api_key",
          apiKey: "secret",
        },
      });

      expect(result.endpointId).toBe("gateway-gateway-example-test");
      expect(endpointRegistry.list()[0]).toEqual({
        id: "gateway-gateway-example-test",
        label: "Gateway (gateway.example.test)",
        rootUrl: "https://gateway.example.test",
        profile: "generic-gateway",
        protocols: {
          openai: {
            basePath: "/v1",
            wireApis: ["responses", "chat"],
            authSchemes: ["bearer"],
            envKeyOverride: "OPENAI_API_KEY",
          },
          anthropic: {
            authSchemes: ["bearer"],
            envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
            versionHeader: "2023-06-01",
          },
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(accessRegistry.list()[0]?.enabledAgents).toEqual(["codex", "claude"]);
    } finally {
      database.close();
    }
  });

  test("falls back to manually enabled gateway agents when detection is explicitly bypassed", async () => {
    const dbPath = createTempDatabasePath();
    const database = SqliteDatabase.open(dbPath);
    const credentialStore = new StubCredentialStore();
    const endpointRegistry = EndpointRegistry.fromDatabase(database);
    const accessRegistry = AccessRegistry.fromDatabase(
      database,
      credentialStore,
      new StaticCredentialSourceFactory(),
    );
    const creator = new ConnectionCreator(
      endpointRegistry,
      accessRegistry,
      new ThrowingGatewayProbe(),
    );

    try {
      const result = await creator.create({
        preset: "gateway",
        authMode: "api_key",
        endpointUrl: "https://gateway.example.test/v1",
        enabledAgents: ["codex"],
        allowUndetectedGateway: true,
        credential: {
          kind: "api_key",
          apiKey: "secret",
        },
      });

      expect(result.endpointId).toBe("gateway-gateway-example-test");
      expect(endpointRegistry.list()[0]).toEqual({
        id: "gateway-gateway-example-test",
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
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(accessRegistry.list()[0]?.enabledAgents).toEqual(["codex"]);
    } finally {
      database.close();
    }
  });

  test("reuses an existing env-key-backed API-key connection", async () => {
    const dbPath = createTempDatabasePath();
    const database = SqliteDatabase.open(dbPath);
    const credentialStore = new StubCredentialStore();
    const endpointRegistry = EndpointRegistry.fromDatabase(database);
    const accessRegistry = AccessRegistry.fromDatabase(
      database,
      credentialStore,
      new StaticCredentialSourceFactory(),
    );
    const creator = new ConnectionCreator(
      endpointRegistry,
      accessRegistry,
    );

    try {
      const created = await creator.create({
        preset: "azure-openai",
        authMode: "api_key",
        endpointUrl: "https://example.cognitiveservices.azure.com/openai/v1",
        credential: {
          kind: "api_key",
          source: "env_key",
          envKey: "OPENAI_API_KEY_WORK",
        },
      });
      const reused = await creator.create({
        preset: "azure-openai",
        authMode: "api_key",
        endpointUrl: "https://example.cognitiveservices.azure.com/openai/v1",
        credential: {
          kind: "api_key",
          source: "env_key",
          envKey: "OPENAI_API_KEY_WORK",
        },
      });

      expect(created.id).toBe(reused.id);
      expect(reused.reused).toBe(true);
    } finally {
      database.close();
    }
  });

  test("upgrades an existing gateway endpoint in place when probing finds more protocols", async () => {
    const dbPath = createTempDatabasePath();
    const database = SqliteDatabase.open(dbPath);
    const credentialStore = new StubCredentialStore();
    const endpointRegistry = EndpointRegistry.fromDatabase(database);
    endpointRegistry.add({
      id: "gateway-gateway-example-test",
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
      },
    });
    const accessRegistry = AccessRegistry.fromDatabase(
      database,
      credentialStore,
      new StaticCredentialSourceFactory(),
    );
    accessRegistry.add({
      id: "frank",
      endpointId: "gateway-gateway-example-test",
      label: "Frank",
      authMode: "api_key",
    }, {
      kind: "api_key",
      apiKey: "secret",
    });
    const creator = new ConnectionCreator(
      endpointRegistry,
      accessRegistry,
      new StubGatewayProbe({
        openai: {
          basePath: "/v1",
          wireApis: ["responses", "chat"],
          authSchemes: ["bearer"],
          envKeyOverride: "OPENAI_API_KEY",
        },
        anthropic: {
          authSchemes: ["bearer"],
          envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
          versionHeader: "2023-06-01",
        },
      }),
    );

    try {
      const result = await creator.create({
        preset: "gateway",
        authMode: "api_key",
        endpointUrl: "https://gateway.example.test",
        label: "Frank",
        credential: {
          kind: "api_key",
          apiKey: "secret",
        },
      });

      expect(result).toEqual({
        id: "frank",
        label: "Frank",
        endpointId: "gateway-gateway-example-test",
        endpointLabel: "Gateway (gateway.example.test)",
        endpointFamily: "gateway",
        authMode: "api_key",
        reused: true,
      });
      expect(endpointRegistry.list()).toHaveLength(1);
      expect(accessRegistry.get("frank")?.enabledAgents).toEqual(["codex", "claude"]);
      expect(endpointRegistry.get("gateway-gateway-example-test")).toEqual(
        expect.objectContaining({
          protocols: {
            openai: {
              basePath: "/v1",
              wireApis: ["responses", "chat"],
              authSchemes: ["bearer"],
              envKeyOverride: "OPENAI_API_KEY",
            },
            anthropic: {
              authSchemes: ["bearer"],
              envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
              versionHeader: "2023-06-01",
            },
          },
        }),
      );
    } finally {
      database.close();
    }
  });

  test("merges gateway protocols into an existing same-url endpoint with a different id", async () => {
    const dbPath = createTempDatabasePath();
    const database = SqliteDatabase.open(dbPath);
    const credentialStore = new StubCredentialStore();
    const endpointRegistry = EndpointRegistry.fromDatabase(database);
    endpointRegistry.add({
      id: "claude",
      label: "Claude Gateway",
      rootUrl: "https://gateway.example.test",
      profile: "generic-gateway",
      protocols: {
        anthropic: {
          authSchemes: ["bearer"],
          envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
          versionHeader: "2023-06-01",
        },
      },
    });
    const accessRegistry = AccessRegistry.fromDatabase(
      database,
      credentialStore,
      new StaticCredentialSourceFactory(),
    );
    const creator = new ConnectionCreator(
      endpointRegistry,
      accessRegistry,
      new StubGatewayProbe({
        openai: {
          basePath: "/v1",
          wireApis: ["responses", "chat"],
          authSchemes: ["bearer"],
          envKeyOverride: "OPENAI_API_KEY",
        },
        anthropic: null,
      }),
    );

    try {
      const result = await creator.create({
        preset: "gateway",
        authMode: "api_key",
        endpointUrl: "https://gateway.example.test",
        label: "Gateway Key",
        credential: {
          kind: "api_key",
          apiKey: "secret",
        },
      });

      expect(result.endpointId).toBe("claude");
      expect(endpointRegistry.list()).toHaveLength(1);
      expect(endpointRegistry.get("claude")).toEqual(
        expect.objectContaining({
          label: "Gateway (gateway.example.test)",
          rootUrl: "https://gateway.example.test",
          profile: "generic-gateway",
          protocols: {
            openai: {
              basePath: "/v1",
              wireApis: ["responses", "chat"],
              authSchemes: ["bearer"],
              envKeyOverride: "OPENAI_API_KEY",
            },
            anthropic: {
              authSchemes: ["bearer"],
              envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
              versionHeader: "2023-06-01",
            },
          },
        }),
      );
    } finally {
      database.close();
    }
  });

  test("updates enabled agents when reusing an existing gateway access", async () => {
    const dbPath = createTempDatabasePath();
    const database = SqliteDatabase.open(dbPath);
    const credentialStore = new StubCredentialStore();
    const endpointRegistry = EndpointRegistry.fromDatabase(database);
    endpointRegistry.add({
      id: "gateway-gateway-example-test",
      label: "Gateway (gateway.example.test)",
      rootUrl: "https://gateway.example.test",
      profile: "generic-gateway",
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: ["responses", "chat"],
          authSchemes: ["bearer"],
          envKeyOverride: "OPENAI_API_KEY",
        },
        anthropic: {
          authSchemes: ["bearer"],
          envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
          versionHeader: "2023-06-01",
        },
      },
    });
    const accessRegistry = AccessRegistry.fromDatabase(
      database,
      credentialStore,
      new StaticCredentialSourceFactory(),
    );
    accessRegistry.add({
      id: "frank",
      endpointId: "gateway-gateway-example-test",
      label: "Frank",
      authMode: "api_key",
      enabledAgents: ["codex", "claude"],
    }, {
      kind: "api_key",
      apiKey: "secret",
    });
    const creator = new ConnectionCreator(
      endpointRegistry,
      accessRegistry,
      new StubGatewayProbe({
        openai: {
          basePath: "/v1",
          wireApis: ["responses", "chat"],
          authSchemes: ["bearer"],
          envKeyOverride: "OPENAI_API_KEY",
        },
        anthropic: {
          authSchemes: ["bearer"],
          envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
          versionHeader: "2023-06-01",
        },
      }),
    );

    try {
      await creator.create({
        preset: "gateway",
        authMode: "api_key",
        endpointUrl: "https://gateway.example.test",
        label: "Frank",
        enabledAgents: ["claude"],
        credential: {
          kind: "api_key",
          apiKey: "secret",
        },
      });

      expect(accessRegistry.get("frank")?.enabledAgents).toEqual(["claude"]);
    } finally {
      database.close();
    }
  });

  test("reuses an existing openai_session access when the session refresh token matches", async () => {
    const dbPath = createTempDatabasePath();
    const database = SqliteDatabase.open(dbPath);
    const credentialStore = new StubCredentialStore();
    const endpointRegistry = EndpointRegistry.fromDatabase(database);
    endpointRegistry.add({
      id: "openai",
      label: "OpenAI",
      rootUrl: "https://api.openai.com",
      profile: "openai-official",
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: ["responses"],
          authSchemes: ["bearer"],
          envKeyOverride: "OPENAI_API_KEY",
        },
      },
    });
    const accessRegistry = AccessRegistry.fromDatabase(
      database,
      credentialStore,
      new StaticCredentialSourceFactory(),
    );
    accessRegistry.add({
      id: "jay-openai",
      endpointId: "openai",
      label: "cursor.user@example.com",
      authMode: "openai_session",
      enabledAgents: ["codex"],
    }, {
      kind: "openai_session",
      idToken: "header.old-token.signature",
      accessToken: "access-old",
      refreshToken: "refresh-shared",
    });
    const creator = new ConnectionCreator(
      endpointRegistry,
      accessRegistry,
    );

    try {
      const result = await creator.create({
        preset: "openai",
        authMode: "openai_session",
        credential: {
          kind: "openai_session",
          idToken: "header.new-token.signature",
          accessToken: "access-new",
          refreshToken: "refresh-shared",
        },
      });

      expect(result).toEqual({
        id: "jay-openai",
        label: "OpenAI Session",
        endpointId: "openai",
        endpointLabel: "OpenAI",
        endpointFamily: "openai",
        authMode: "openai_session",
        reused: true,
      });
    } finally {
      database.close();
    }
  });
});

function createTempDatabasePath(): string {
  const root = mkdtempSync(join(tmpdir(), "nile-connection-creator-"));
  tempRoots.push(root);
  return join(root, "switcher.sqlite");
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

class ThrowingAccessStore extends SqliteAccessStore {
  constructor(database: SqliteDatabase) {
    super(database);
  }

  override insert(_record: AccessRecord): void {
    super.insert(_record);
    throw new Error("Injected connection insert failure");
  }
}

class StaticCredentialSourceFactory {
  createAccessSource(input: { accessId: string }) {
    return {
      kind: "local" as const,
      reference: `access:${input.accessId}`,
      scope: "access" as const,
      allowLocalMaterialization: true,
    };
  }

  createCursorUsageSource(input: { connectionId: string }) {
    return {
      kind: "local" as const,
      reference: `usage:cursor:${input.connectionId}`,
      scope: "usage" as const,
      allowLocalMaterialization: true,
    };
  }
}

class StubGatewayProbe {
  constructor(private readonly result: GatewayProbeResult) {}

  async probe(): Promise<GatewayProbeResult> {
    return this.result;
  }
}

class ThrowingGatewayProbe {
  async probe(): Promise<GatewayProbeResult> {
    throw new Error("Injected gateway probe failure");
  }
}
