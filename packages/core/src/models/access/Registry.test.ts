import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { LocalCredentialSourceFactory } from "../../services/credential/Factory";
import { type StoredCredential } from "../../services/credential/Types";
import { KeychainCredentialStore } from "../../services/credential/KeychainCredentialStore";
import { normalizeCredentialStoreTarget, type CredentialStoreTarget } from "../../services/credential";
import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import { EndpointRegistry } from "../endpoint";
import { SqliteAccessStore } from "./SqliteAccessStore";
import {
  AccessRegistry,
  AccessRegistryConsistencyError,
  AccessRegistryValidationError,
  DuplicateAccessIdError,
} from "./index";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("AccessRegistry", () => {
  it("adds access records and stores credentials under access scope", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new StubCredentialStore();
    seedEndpoint(dbPath, {
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
        anthropic: {
          basePath: "/v1",
          authSchemes: ["bearer"],
        },
      },
    });

    const registry = AccessRegistry.open(dbPath, credentialStore);

    const record = registry.add(
      {
        id: "gateway-team",
        endpointId: "gateway",
        label: "Gateway Team",
        authMode: "api_key",
        identityKey: "key:team",
      },
      { kind: "api_key", apiKey: "gateway-secret" },
    );

    expect(record.credentialSource.reference).toBe("access:gateway-team");
    expect(record.credentialSource.scope).toBe("access");
    expect(credentialStore.records.get("access:gateway-team")).toEqual({
      kind: "api_key",
      apiKey: "gateway-secret",
    });

    registry.close();
  });

  it("updates labels and refreshes credentials", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new StubCredentialStore();
    seedEndpoint(dbPath, {
      id: "gateway",
      label: "Gateway",
      rootUrl: "https://gateway.example.test",
      protocols: {
        openai: {
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
      },
    });

    const registry = AccessRegistry.open(dbPath, credentialStore);
    registry.add(
      {
        id: "gateway-team",
        endpointId: "gateway",
        label: "Gateway Team",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "gateway-secret" },
    );

    const updated = registry.update(
      "gateway-team",
      {
        label: "Gateway Shared",
        identityKey: "key:shared",
      },
      { kind: "api_key", apiKey: "fresh-secret" },
    );

    expect(updated.label).toBe("Gateway Shared");
    expect(updated.identityKey).toBe("key:shared");
    expect(credentialStore.records.get("access:gateway-team")).toEqual({
      kind: "api_key",
      apiKey: "fresh-secret",
    });

    registry.close();
  });

  it("persists credential storage backend metadata across reloads", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new StubCredentialStore();
    seedEndpoint(dbPath, {
      id: "gateway",
      label: "Gateway",
      rootUrl: "https://gateway.example.test",
      protocols: {
        openai: {
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
      },
    });

    const registry = AccessRegistry.open(dbPath, credentialStore);
    registry.add(
      {
        id: "gateway-team",
        endpointId: "gateway",
        label: "Gateway Team",
        authMode: "api_key",
        credentialStorageBackend: "encrypted_local_storage",
      },
      { kind: "api_key", apiKey: "gateway-secret" },
    );
    registry.close();

    const reopened = AccessRegistry.open(dbPath, credentialStore);
    expect(reopened.get("gateway-team")).toEqual(expect.objectContaining({
      credentialStorageBackend: "encrypted_local_storage",
    }));
    reopened.close();
  });

  it("removes credentials when access is removed", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new StubCredentialStore();
    seedEndpoint(dbPath, {
      id: "openai-official",
      label: "OpenAI Official",
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

    const registry = AccessRegistry.open(dbPath, credentialStore);
    registry.add(
      {
        id: "openai-work",
        endpointId: "openai-official",
        label: "OpenAI Work",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "secret-openai" },
    );

    registry.remove("openai-work");

    expect(credentialStore.has("access:openai-work")).toBe(false);

    registry.close();
  });

  it("rejects access records for unknown endpoints", () => {
    const registry = AccessRegistry.open(createTempDatabasePath(), new StubCredentialStore());

    expect(() => registry.add(
      {
        id: "missing",
        endpointId: "missing-endpoint",
        label: "Missing",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "secret" },
    )).toThrow(AccessRegistryValidationError);

    registry.close();
  });

  it("rejects duplicate access ids", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new StubCredentialStore();
    seedEndpoint(dbPath, {
      id: "claude-official",
      label: "Claude Official",
      rootUrl: "https://api.anthropic.com",
      profile: "anthropic-official",
      protocols: {
        anthropic: {
          authSchemes: ["x_api_key"],
        },
      },
    });

    const registry = AccessRegistry.open(dbPath, credentialStore);
    registry.add(
      {
        id: "claude-work",
        endpointId: "claude-official",
        label: "Claude Work",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "secret-1" },
    );

    expect(() => registry.add(
      {
        id: "claude-work",
        endpointId: "claude-official",
        label: "Claude Work 2",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "secret-2" },
    )).toThrow(DuplicateAccessIdError);

    registry.close();
  });

  it("rejects explicit empty enabled agents", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new StubCredentialStore();
    seedEndpoint(dbPath, {
      id: "gateway",
      label: "Gateway",
      rootUrl: "https://router.example",
      protocols: {
        openai: {
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
      },
    });

    const registry = AccessRegistry.open(dbPath, credentialStore);

    expect(() => registry.add(
      {
        id: "gateway-team",
        endpointId: "gateway",
        label: "Gateway Team",
        authMode: "api_key",
        enabledAgents: [],
      },
      { kind: "api_key", apiKey: "secret" },
    )).toThrow("Access must enable at least one agent");

    registry.close();
  });

  it("infers Gemini as the enabled agent for Gemini CLI session connections", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new StubCredentialStore();
    seedEndpoint(dbPath, {
      id: "gemini",
      label: "Gemini CLI",
      rootUrl: "https://gemini.google.com",
      profile: "gemini-cli",
      protocols: {
        gemini: {
          authTypes: ["oauth-personal"],
        },
      },
    });

    const registry = AccessRegistry.open(dbPath, credentialStore);
    const record = registry.add(
      {
        id: "gemini-primary",
        endpointId: "gemini",
        label: "gemini.primary@example.test",
        authMode: "gemini_cli_session",
      },
      {
        kind: "gemini_cli_session",
        accessToken: "gemini-access-token",
        refreshToken: "gemini-refresh-token",
        idToken: "gemini-id-token",
      },
    );

    expect(record.enabledAgents).toEqual(["gemini"]);

    registry.close();
  });

  it("restores the previous credential when access update persistence fails", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new StubCredentialStore();
    seedEndpoint(dbPath, {
      id: "gateway",
      label: "Gateway",
      rootUrl: "https://gateway.example.test",
      protocols: {
        openai: {
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
      },
    });

    const registry = AccessRegistry.open(dbPath, credentialStore);
    registry.add(
      {
        id: "gateway-team",
        endpointId: "gateway",
        label: "Gateway Team",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "original-secret" },
    );
    registry.close();

    const database = SqliteDatabase.open(dbPath);
    const failing = new AccessRegistry(
      new ThrowingAccessStore(database, "update"),
      credentialStore,
      EndpointRegistry.fromDatabase(database),
      new LocalCredentialSourceFactory(),
      database,
    );

    expect(() =>
      failing.update(
        "gateway-team",
        { label: "Gateway Shared" },
        { kind: "api_key", apiKey: "fresh-secret" },
      ),
    ).toThrow("Injected update failure");
    expect(credentialStore.records.get("access:gateway-team")).toEqual({
      kind: "api_key",
      apiKey: "original-secret",
    });

    failing.close();
  });

  it("marks access removal as failed when sqlite delete fails after credential removal", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new StubCredentialStore();
    seedEndpoint(dbPath, {
      id: "gateway",
      label: "Gateway",
      rootUrl: "https://gateway.example.test",
      protocols: {
        openai: {
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
      },
    });

    const registry = AccessRegistry.open(dbPath, credentialStore);
    registry.add(
      {
        id: "gateway-team",
        endpointId: "gateway",
        label: "Gateway Team",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "original-secret" },
    );
    registry.close();

    const database = SqliteDatabase.open(dbPath);
    const failing = new AccessRegistry(
      new ThrowingAccessStore(database, "remove"),
      credentialStore,
      EndpointRegistry.fromDatabase(database),
      new LocalCredentialSourceFactory(),
      database,
    );

    expect(() => failing.remove("gateway-team")).toThrow("Injected remove failure");
    expect(credentialStore.has("access:gateway-team")).toBe(false);
    expect(failing.get("gateway-team")).toEqual(
      expect.objectContaining({
        credentialSyncState: "delete_failed",
        credentialSyncIssue: "Injected remove failure",
      }),
    );
    expect(() => failing.readCredential("gateway-team")).toThrow(AccessRegistryConsistencyError);

    failing.close();
  });

  it("persists write failure state when credential sync fails after access create", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new FailingCredentialStore("create");
    seedEndpoint(dbPath, {
      id: "gateway",
      label: "Gateway",
      rootUrl: "https://gateway.example.test",
      protocols: {
        openai: {
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
      },
    });

    const registry = AccessRegistry.open(dbPath, credentialStore);

    expect(() => registry.add(
      {
        id: "gateway-team",
        endpointId: "gateway",
        label: "Gateway Team",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "secret" },
    )).toThrow(AccessRegistryConsistencyError);

    expect(registry.get("gateway-team")).toEqual(
      expect.objectContaining({
        credentialSyncState: "write_failed",
        credentialSyncIssue: "Injected credential create failure",
      }),
    );
    expect(() => registry.readCredential("gateway-team")).toThrow(AccessRegistryConsistencyError);

    registry.close();
  });
});

function createTempDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-access-registry-"));
  tempDirs.push(dir);
  return join(dir, "switcher.sqlite");
}

function seedEndpoint(
  dbPath: string,
  input: Parameters<EndpointRegistry["add"]>[0],
): void {
  const registry = EndpointRegistry.open(dbPath);
  registry.add(input);
  registry.close();
}

class StubCredentialStore extends KeychainCredentialStore {
  readonly records = new Map<string, StoredCredential>();

  override create(target: CredentialStoreTarget, credential: StoredCredential): void {
    this.records.set(normalizeCredentialStoreTarget(target).reference, credential);
  }

  override update(target: CredentialStoreTarget, credential: StoredCredential): void {
    this.records.set(normalizeCredentialStoreTarget(target).reference, credential);
  }

  override get(target: CredentialStoreTarget): StoredCredential {
    const reference = normalizeCredentialStoreTarget(target).reference;
    const credential = this.records.get(reference);
    if (!credential) {
      throw new Error(`Missing stub credential: ${reference}`);
    }
    return credential;
  }

  override has(target: CredentialStoreTarget): boolean {
    return this.records.has(normalizeCredentialStoreTarget(target).reference);
  }

  override remove(target: CredentialStoreTarget): void {
    this.records.delete(normalizeCredentialStoreTarget(target).reference);
  }
}

class FailingCredentialStore extends StubCredentialStore {
  constructor(private readonly failureMode: "create" | "update") {
    super();
  }

  override create(reference: string, credential: StoredCredential): void {
    if (this.failureMode === "create") {
      throw new Error("Injected credential create failure");
    }
    super.create(reference, credential);
  }

  override update(reference: string, credential: StoredCredential): void {
    if (this.failureMode === "update") {
      throw new Error("Injected credential update failure");
    }
    super.update(reference, credential);
  }
}

class ThrowingAccessStore extends SqliteAccessStore {
  constructor(
    database: SqliteDatabase,
    private readonly failureMode: "update" | "remove",
  ) {
    super(database);
  }

  override update(record: Parameters<SqliteAccessStore["update"]>[0]): void {
    if (this.failureMode === "update") {
      throw new Error("Injected update failure");
    }
    super.update(record);
  }

  override remove(accessId: string): void {
    if (this.failureMode === "remove") {
      throw new Error("Injected remove failure");
    }
    super.remove(accessId);
  }
}
