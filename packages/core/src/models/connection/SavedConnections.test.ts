import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AccessRegistry } from "../access";
import { SqliteAccessStore } from "../access/SqliteAccessStore";
import { KeychainCredentialStore } from "../../services/credential/KeychainCredentialStore";
import type { StoredCredential } from "../../services/credential/Types";
import { EndpointRegistry } from "../endpoint";
import { SqliteEndpointStore } from "../endpoint/SqliteEndpointStore";
import { AgentSelection } from "../selection/Selection";
import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import { SUPPORTED_AGENT_IDS } from "../agent";
import { SavedConnections } from "./SavedConnections";

const tempRoots: string[] = [];

describe("SavedConnections", () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      rmSync(tempRoots.pop()!, { recursive: true, force: true });
    }
  });

  test("lists saved connections with selected targets", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new StubCredentialStore();
    seedConnection(dbPath, credentialStore, {
      endpointId: "openai",
      endpointLabel: "OpenAI",
      endpointFamily: "openai",
      accessId: "openai-session",
      accountLabel: "primary@example.com",
      authMode: "openai_session",
      credential: {
        kind: "openai_session",
        accountId: "acct_123",
        idToken: "id",
        accessToken: "access",
        refreshToken: "refresh",
      },
    });

    const selection = AgentSelection.open(dbPath);
    selection.setApplied("codex", "openai-session");
    selection.close();

    const connections = SavedConnections.open(dbPath, credentialStore);
    try {
      expect(connections.list()).toEqual([
        {
          id: "openai-session",
          endpointId: "openai",
          endpointUrl: "https://api.openai.com/v1",
          label: "primary@example.com",
          endpointLabel: "OpenAI",
          endpointFamily: "openai",
          authMode: "openai_session",
          enabledAgents: ["codex"],
          configurableAgents: ["codex"],
          selectedByAgents: ["codex"],
        },
      ]);
    } finally {
      connections.close();
    }
  });

  test("lists multi-protocol gateway connections for both codex and claude", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new StubCredentialStore();

    const endpointRegistry = EndpointRegistry.open(dbPath);
    endpointRegistry.add({
      id: "gateway-llmfk-dpdns-org",
      label: "Gateway (gateway.example.test)",
      rootUrl: "https://gateway.example.test",
      profile: "generic-gateway",
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
        anthropic: {
          authSchemes: ["bearer"],
          envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
          versionHeader: "2023-06-01",
        },
      },
    });
    endpointRegistry.close();

    const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
    accessRegistry.add({
      id: "frank",
      endpointId: "gateway-llmfk-dpdns-org",
      label: "Frank",
      authMode: "api_key",
    }, {
      kind: "api_key",
      apiKey: "secret",
    });
    accessRegistry.close();

    const connections = SavedConnections.open(dbPath, credentialStore);
    try {
      expect(connections.listForAgent("codex").map((entry) => entry.id)).toEqual(["frank"]);
      expect(connections.listForAgent("claude").map((entry) => entry.id)).toEqual(["frank"]);
    } finally {
      connections.close();
    }
  });

  test("treats saved gateway connections as configurable for all supported agents", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new StubCredentialStore();

    const endpointRegistry = EndpointRegistry.open(dbPath);
    endpointRegistry.add({
      id: "gateway-all-agents",
      label: "Gateway (all agents)",
      rootUrl: "https://gateway.example.com",
      profile: "generic-gateway",
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
      },
    });
    endpointRegistry.close();

    const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
    accessRegistry.add({
      id: "gateway-primary",
      endpointId: "gateway-all-agents",
      label: "Gateway Primary",
      authMode: "api_key",
    }, {
      kind: "api_key",
      apiKey: "secret",
    });
    accessRegistry.close();

    const connections = SavedConnections.open(dbPath, credentialStore);
    try {
      expect(connections.list()).toEqual([
        expect.objectContaining({
          id: "gateway-primary",
          endpointFamily: "gateway",
          configurableAgents: [...SUPPORTED_AGENT_IDS],
        }),
      ]);
    } finally {
      connections.close();
    }
  });

  test("omits enabled agents that the endpoint protocols do not support", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new StubCredentialStore();

    const endpointRegistry = EndpointRegistry.open(dbPath);
    endpointRegistry.add({
      id: "gateway-openai-only",
      label: "Gateway (OpenAI only)",
      rootUrl: "https://gateway.example.com",
      profile: "generic-gateway",
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
      },
    });
    endpointRegistry.close();

    const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
    accessRegistry.add({
      id: "gateway-primary",
      endpointId: "gateway-openai-only",
      label: "Gateway Primary",
      authMode: "api_key",
      enabledAgents: ["codex", "claude"],
    }, {
      kind: "api_key",
      apiKey: "secret",
    });
    accessRegistry.close();

    const connections = SavedConnections.open(dbPath, credentialStore);
    try {
      expect(connections.list()).toEqual([
        expect.objectContaining({
          id: "gateway-primary",
          enabledAgents: ["codex"],
        }),
      ]);
      expect(connections.listForAgent("claude")).toEqual([]);
    } finally {
      connections.close();
    }
  });

  test("removes saved connections and clears saved agent selections that pointed at them", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new StubCredentialStore();
    seedConnection(dbPath, credentialStore, {
      endpointId: "azure",
      endpointLabel: "Azure OpenAI",
      endpointFamily: "azure-openai",
      accessId: "azure-key",
      accountLabel: "Azure API Key",
      authMode: "api_key",
      credential: {
        kind: "api_key",
        apiKey: "secret",
      },
    });

    const selection = AgentSelection.open(dbPath);
    selection.setApplied("codex", "azure-key");
    selection.close();

    const connections = SavedConnections.open(dbPath, credentialStore);
    try {
      expect(connections.remove("azure-key")).toEqual({
        id: "azure-key",
        removed: true,
        clearedAgents: ["codex"],
      });
    } finally {
      connections.close();
    }

    const agentSelection = AgentSelection.open(dbPath);
    try {
      expect(agentSelection.get("codex")).toBeNull();
    } finally {
      agentSelection.close();
    }

    const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
    try {
      expect(accessRegistry.get("azure-key")).toBeNull();
    } finally {
      accessRegistry.close();
    }
  });

  test("updates a saved connection label and keeps selected agents enabled", async () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new StubCredentialStore();
    seedConnection(dbPath, credentialStore, {
      endpointId: "openai",
      endpointLabel: "OpenAI",
      endpointFamily: "openai",
      accessId: "openai-session",
      accountLabel: "primary@example.com",
      authMode: "openai_session",
      credential: {
        kind: "openai_session",
        accountId: "acct_123",
        idToken: "id",
        accessToken: "access",
        refreshToken: "refresh",
      },
    });

    const selection = AgentSelection.open(dbPath);
    selection.setApplied("codex", "openai-session");
    selection.close();

    const connections = SavedConnections.open(dbPath, credentialStore);
    try {
      await expect(connections.update({
        connectionId: "openai-session",
        label: "Primary session",
        enabledAgents: [],
      })).resolves.toEqual({
        id: "openai-session",
        endpointId: "openai",
        endpointUrl: "https://api.openai.com/v1",
        label: "Primary session",
        endpointLabel: "OpenAI",
        endpointFamily: "openai",
        authMode: "openai_session",
        enabledAgents: ["codex"],
        configurableAgents: ["codex"],
        selectedByAgents: ["codex"],
      });
    } finally {
      connections.close();
    }
  });

  test("removes the endpoint only after its last access is removed", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new StubCredentialStore();
    seedConnection(dbPath, credentialStore, {
      endpointId: "openai",
      endpointLabel: "OpenAI",
      endpointFamily: "openai",
      accessId: "shared-session",
      accountLabel: "primary@example.com",
      authMode: "openai_session",
      credential: {
        kind: "openai_session",
        accountId: "acct_123",
        idToken: "id",
        accessToken: "access",
        refreshToken: "refresh",
      },
    });

    const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
    try {
      accessRegistry.add({
        id: "work-session",
        endpointId: "openai",
        label: "Work Session",
        authMode: "openai_session",
      }, {
        kind: "openai_session",
        accountId: "acct_456",
        idToken: "id-2",
        accessToken: "access-2",
        refreshToken: "refresh-2",
      });
    } finally {
      accessRegistry.close();
    }

    const connections = SavedConnections.open(dbPath, credentialStore);
    try {
      expect(connections.remove("shared-session")).toEqual({
        id: "shared-session",
        removed: true,
        clearedAgents: [],
      });
    } finally {
      connections.close();
    }

    const endpointRegistry = EndpointRegistry.open(dbPath);
    try {
      expect(endpointRegistry.get("openai")).toEqual(
        expect.objectContaining({ id: "openai" }),
      );
    } finally {
      endpointRegistry.close();
    }
  });

  test("preserves explicit delete failure state when access cleanup fails", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new StubCredentialStore();
    seedConnection(dbPath, credentialStore, {
      endpointId: "azure",
      endpointLabel: "Azure OpenAI",
      endpointFamily: "azure-openai",
      accessId: "azure-key",
      accountLabel: "Azure API Key",
      authMode: "api_key",
      credential: {
        kind: "api_key",
        apiKey: "secret",
      },
    });

    const database = SqliteDatabase.open(dbPath);
    const endpointRegistry = new EndpointRegistry(
      new SqliteEndpointStore(database),
      null,
    );
    const accessRegistry = new AccessRegistry(
      new ThrowingAccessStore(database),
      credentialStore,
      endpointRegistry,
      new StaticCredentialSourceFactory(),
    );
    const connections = new SavedConnections(
      database,
      endpointRegistry,
      accessRegistry,
      AgentSelection.fromDatabase(database),
      database,
    );

    try {
      expect(() => connections.remove("azure-key")).toThrow("Injected access remove failure");
      expect(accessRegistry.get("azure-key")).toEqual(
        expect.objectContaining({
          id: "azure-key",
          credentialSyncIssue: "Injected access remove failure",
          credentialSyncState: "delete_failed",
        }),
      );
      expect(credentialStore.has("access:azure-key")).toBe(false);
    } finally {
      connections.close();
    }
  });

  test("preloads selections and endpoints when listing connections", () => {
    const endpointRegistry = new CountingEndpointRegistry([
      {
        id: "openai",
        label: "OpenAI",
        rootUrl: "https://api.openai.com",
        profile: "openai-official" as const,
        protocols: {
          openai: {
            basePath: "/v1",
            wireApis: ["responses"] as const,
            authSchemes: ["bearer"] as const,
          },
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const accessRegistry = new StubListingAccessRegistry([
      {
        id: "primary",
        endpointId: "openai",
        label: "Primary",
        authMode: "openai_session" as const,
        enabledAgents: ["codex"] as const,
        credentialSource: {
          kind: "local" as const,
          reference: "access:primary",
          scope: "access" as const,
          allowLocalMaterialization: true,
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "secondary",
        endpointId: "openai",
        label: "Secondary",
        authMode: "openai_session" as const,
        enabledAgents: ["codex"] as const,
        credentialSource: {
          kind: "local" as const,
          reference: "access:secondary",
          scope: "access" as const,
          allowLocalMaterialization: true,
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const selectionStore = new StubAgentSelection([
      {
        agentId: "codex",
        connectionId: "primary",
        endpointId: "openai",
        accessId: "primary",
        appliedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        agentId: "claude",
        connectionId: "primary",
        endpointId: "openai",
        accessId: "primary",
        appliedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const connections = new SavedConnections(
      null as unknown as SqliteDatabase,
      endpointRegistry as unknown as EndpointRegistry,
      accessRegistry as unknown as AccessRegistry,
      selectionStore as unknown as AgentSelection,
    );

    expect(connections.list()).toHaveLength(2);
    expect(endpointRegistry.listCalls).toBe(1);
    expect(endpointRegistry.getCalls).toBe(0);
    expect(selectionStore.listCalls).toBe(1);
  });
});

function createTempDatabasePath(): string {
  const root = mkdtempSync(join(tmpdir(), "nile-saved-connections-"));
  tempRoots.push(root);
  return join(root, "switcher.sqlite");
}

function seedConnection(
  dbPath: string,
  credentialStore: StubCredentialStore,
  input: {
    endpointId: string;
    endpointLabel: string;
    endpointFamily: "openai" | "azure-openai";
    accessId: string;
    accountLabel: string;
    authMode: "openai_session" | "api_key";
    credential: StoredCredential;
  },
): void {
  const endpointRegistry = EndpointRegistry.open(dbPath);
  endpointRegistry.add({
    id: input.endpointId,
    label: input.endpointLabel,
    rootUrl: input.endpointFamily === "azure-openai"
      ? "https://example.cognitiveservices.azure.com"
      : "https://api.openai.com",
    profile: input.endpointFamily === "azure-openai" ? "azure-openai" : "openai-official",
    protocols: {
      openai: {
        basePath: input.endpointFamily === "azure-openai" ? "/openai/v1" : "/v1",
        wireApis: ["responses"],
        authSchemes: ["bearer"],
      },
    },
  });
  endpointRegistry.close();

  const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
  accessRegistry.add(
    {
      id: input.accessId,
      endpointId: input.endpointId,
      label: input.accountLabel,
      authMode: input.authMode,
    },
    input.credential,
  );
  accessRegistry.close();
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
  override remove(_accessId: string): void {
    throw new Error("Injected access remove failure");
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

class CountingEndpointRegistry {
  listCalls = 0;
  getCalls = 0;

  constructor(private readonly endpoints: Array<{
    id: string;
    label: string;
    rootUrl: string;
    profile: "openai-official";
    protocols: {
      openai: {
        basePath: "/v1";
        wireApis: readonly ["responses"];
        authSchemes: readonly ["bearer"];
      };
    };
    createdAt: string;
    updatedAt: string;
  }>) {}

  list() {
    this.listCalls += 1;
    return this.endpoints;
  }

  get(endpointId: string) {
    this.getCalls += 1;
    return this.endpoints.find((endpoint) => endpoint.id === endpointId) ?? null;
  }
}

class StubListingAccessRegistry {
  constructor(private readonly accesses: Array<{
    id: string;
    endpointId: string;
    label: string;
    authMode: "openai_session";
    enabledAgents: readonly ["codex"];
    credentialSource: {
      kind: "local";
      reference: string;
      scope: "access";
      allowLocalMaterialization: true;
    };
    createdAt: string;
    updatedAt: string;
  }>) {}

  list() {
    return this.accesses;
  }

  readCredential(): never {
    throw new Error("Unexpected credential read");
  }
}

class StubAgentSelection {
  listCalls = 0;

  constructor(private readonly selections: Array<{
    agentId: "codex" | "claude";
    connectionId: string;
    endpointId: string;
    accessId: string;
    appliedAt: string;
  }>) {}

  list() {
    this.listCalls += 1;
    return this.selections;
  }
}
