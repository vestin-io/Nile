import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { StoredCredential } from "../../services/credential/Types";
import { KeychainCredentialStore } from "../../services/credential/KeychainCredentialStore";
import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import { AccessRegistry } from "../access";
import { EndpointRegistry } from "../endpoint";
import { AgentSelection } from "../selection/Selection";
import { ConnectionUpdater } from "./Updater";
import type { GatewayProbeResult } from "./GatewayProbe";

const tempRoots: string[] = [];

describe("ConnectionUpdater", () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      rmSync(tempRoots.pop()!, { recursive: true, force: true });
    }
  });

  test("moves a shared gateway connection to a new endpoint and refreshes selected agents", async () => {
    const dbPath = createTempDatabasePath();
    const database = SqliteDatabase.open(dbPath);
    const credentialStore = new StubCredentialStore();
    const endpointRegistry = EndpointRegistry.fromDatabase(database);
    const accessRegistry = AccessRegistry.fromDatabase(database, credentialStore);
    const agentSelection = AgentSelection.fromDatabase(database);

    endpointRegistry.add({
      id: "gateway-main",
      label: "Gateway (old.example.com)",
      rootUrl: "https://old.example.com",
      profile: "generic-gateway",
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
      },
    });
    accessRegistry.add({
      id: "primary",
      endpointId: "gateway-main",
      label: "Primary",
      authMode: "api_key",
      enabledAgents: ["codex"],
    }, {
      kind: "api_key",
      apiKey: "secret",
    });
    accessRegistry.add({
      id: "shared",
      endpointId: "gateway-main",
      label: "Shared",
      authMode: "api_key",
      enabledAgents: ["codex"],
    }, {
      kind: "api_key",
      apiKey: "secret-2",
    });
    agentSelection.setApplied("codex", "primary");

    const updater = new ConnectionUpdater(
      database,
      endpointRegistry,
      accessRegistry,
      agentSelection,
      new StubGatewayProbe({
        openai: {
          basePath: "/v1",
          wireApis: ["responses", "chat"],
          authSchemes: ["bearer"],
        },
        anthropic: {
          authSchemes: ["bearer"],
          versionHeader: "2023-06-01",
        },
      }),
    );

    const updated = await updater.update({
      connectionId: "primary",
      endpointUrl: "https://new.example.com",
      enabledAgents: ["codex", "claude"],
      credential: {
        kind: "api_key",
        apiKey: "secret",
      },
    });

    expect(updated.endpointId).toBe("gateway-new-example-com");
    expect(updated.enabledAgents).toEqual(["codex", "claude"]);
    expect(endpointRegistry.get("gateway-main")).toEqual(
      expect.objectContaining({
        rootUrl: "https://old.example.com",
      }),
    );
    expect(endpointRegistry.get("gateway-new-example-com")).toEqual(
      expect.objectContaining({
        rootUrl: "https://new.example.com",
        protocols: {
          openai: {
            basePath: "/v1",
            wireApis: ["responses", "chat"],
            authSchemes: ["bearer"],
          },
          anthropic: {
            authSchemes: ["bearer"],
            versionHeader: "2023-06-01",
          },
        },
      }),
    );
    expect(agentSelection.get("codex")).toEqual(
      expect.objectContaining({
        connectionId: "primary",
        endpointId: "gateway-new-example-com",
      }),
    );

    database.close();
  });

  test("rejects gateway updates that would drop the selected agent capability", async () => {
    const dbPath = createTempDatabasePath();
    const database = SqliteDatabase.open(dbPath);
    const credentialStore = new StubCredentialStore();
    const endpointRegistry = EndpointRegistry.fromDatabase(database);
    const accessRegistry = AccessRegistry.fromDatabase(database, credentialStore);
    const agentSelection = AgentSelection.fromDatabase(database);

    endpointRegistry.add({
      id: "gateway-main",
      label: "Gateway (old.example.com)",
      rootUrl: "https://old.example.com",
      profile: "generic-gateway",
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
      },
    });
    accessRegistry.add({
      id: "primary",
      endpointId: "gateway-main",
      label: "Primary",
      authMode: "api_key",
      enabledAgents: ["codex"],
    }, {
      kind: "api_key",
      apiKey: "secret",
    });
    agentSelection.setApplied("codex", "primary");

    const updater = new ConnectionUpdater(
      database,
      endpointRegistry,
      accessRegistry,
      agentSelection,
      new StubGatewayProbe({
        openai: null,
        anthropic: {
          authSchemes: ["bearer"],
          versionHeader: "2023-06-01",
        },
      }),
    );

    await expect(updater.update({
      connectionId: "primary",
      endpointUrl: "https://claude-only.example.com",
      credential: {
        kind: "api_key",
        apiKey: "secret",
      },
    })).rejects.toThrow("Selected agents are not supported");

    database.close();
  });
});

function createTempDatabasePath(): string {
  const root = mkdtempSync(join(tmpdir(), "nile-connection-updater-"));
  tempRoots.push(root);
  return join(root, "switcher.sqlite");
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
      throw new Error(`Missing credential: ${reference}`);
    }
    return credential;
  }

  override remove(reference: string): void {
    this.records.delete(reference);
  }
}

class StubGatewayProbe {
  constructor(private readonly result: GatewayProbeResult) {}

  async probe(): Promise<GatewayProbeResult> {
    return this.result;
  }
}
