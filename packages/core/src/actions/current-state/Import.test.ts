import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AccessRegistry } from "../../models/access";
import type { DetectedAgentState } from "../../models/agent";
import { EndpointRegistry } from "../../models/endpoint";
import { AgentSelection } from "../../models/selection/Selection";
import { KeychainCredentialStore } from "../../services/credential/KeychainCredentialStore";
import type { StoredCredential } from "../../services/credential/Types";
import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import { NileLogger } from "../../services/NileLogger";
import { CurrentStateImportSupport } from "./Import";

const tempDirs: string[] = [];

describe("CurrentStateImportSupport", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
  });

  it("merges imported agent protocol capabilities into an existing same-url endpoint", () => {
    const setup = createSetup();
    setup.endpointRegistry.add({
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
    const support = new CurrentStateImportSupport(
      "claude",
      "Claude",
      setup.endpointRegistry,
      setup.accessRegistry,
      setup.agentSelection,
      NileLogger.silent(),
    );

    try {
      const result = support.importDetected(createDetectedClaudeGatewayState(), () => ({
        endpoint: {
          id: "claude",
          label: "Claude Gateway",
          rootUrl: "https://gateway.example.test",
          profile: "generic-gateway",
          protocols: {
            anthropic: {
              basePath: "/v1",
              authSchemes: ["bearer"],
              envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
              versionHeader: "2023-06-01",
            },
          },
        },
        access: {
          label: "Claude API Key",
          authMode: "api_key",
        },
        credential: {
          kind: "api_key",
          source: "direct",
          apiKey: "secret",
        },
      }));

      expect(result.endpointId).toBe("gateway-gateway-example-test");
      expect(setup.endpointRegistry.list()).toHaveLength(1);
      expect(setup.endpointRegistry.get("gateway-gateway-example-test")).toEqual(
        expect.objectContaining({
          label: "Claude Gateway",
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
        }),
      );
      expect(setup.accessRegistry.get(result.id)).toEqual(
        expect.objectContaining({
          endpointId: "gateway-gateway-example-test",
          enabledAgents: ["claude"],
        }),
      );
    } finally {
      setup.database.close();
    }
  });

  it("reuses an existing same-key access and adds the imported agent", () => {
    const setup = createSetup();
    setup.endpointRegistry.add({
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
    setup.accessRegistry.add({
      id: "gateway-key",
      endpointId: "gateway-gateway-example-test",
      label: "Gateway Key",
      authMode: "api_key",
      enabledAgents: ["codex"],
    }, {
      kind: "api_key",
      source: "direct",
      apiKey: "secret",
    });
    const support = new CurrentStateImportSupport(
      "claude",
      "Claude",
      setup.endpointRegistry,
      setup.accessRegistry,
      setup.agentSelection,
      NileLogger.silent(),
    );

    try {
      const result = support.importDetected(createDetectedClaudeGatewayState(), () => ({
        endpoint: {
          id: "claude",
          label: "Claude Gateway",
          rootUrl: "https://gateway.example.test",
          profile: "generic-gateway",
          protocols: {
            anthropic: {
              basePath: "/v1",
              authSchemes: ["bearer"],
              envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
              versionHeader: "2023-06-01",
            },
          },
        },
        access: {
          label: "Claude API Key",
          authMode: "api_key",
        },
        credential: {
          kind: "api_key",
          source: "direct",
          apiKey: "secret",
        },
      }));

      expect(result).toEqual(
        expect.objectContaining({
          id: "gateway-key",
          endpointId: "gateway-gateway-example-test",
          reused: true,
        }),
      );
      expect(setup.accessRegistry.get("gateway-key")).toEqual(
        expect.objectContaining({
          endpointId: "gateway-gateway-example-test",
          enabledAgents: ["codex", "claude"],
        }),
      );
      expect(setup.endpointRegistry.get("gateway-gateway-example-test")?.protocols).toEqual({
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
      });
    } finally {
      setup.database.close();
    }
  });
});

function createSetup(): {
  database: SqliteDatabase;
  endpointRegistry: EndpointRegistry;
  accessRegistry: AccessRegistry;
  agentSelection: AgentSelection;
} {
  const root = mkdtempSync(join(tmpdir(), "nile-current-state-import-"));
  tempDirs.push(root);
  const database = SqliteDatabase.open(join(root, "switcher.sqlite"));
  const endpointRegistry = EndpointRegistry.fromDatabase(database);
  const accessRegistry = AccessRegistry.fromDatabase(database, new StubCredentialStore());
  const agentSelection = AgentSelection.fromDatabase(database);
  return {
    database,
    endpointRegistry,
    accessRegistry,
    agentSelection,
  };
}

function createDetectedClaudeGatewayState(): DetectedAgentState {
  return {
    agentId: "claude",
    validity: "valid_import_candidate",
    issues: [],
    endpoint: {
      endpointFamily: "anthropic",
      endpointIdHint: "claude",
      labelHint: "Claude Gateway",
      baseUrl: "https://gateway.example.test/v1",
      envKey: "ANTHROPIC_AUTH_TOKEN",
    },
    access: {
      authMode: "api_key",
      labelHint: "Claude API Key",
    },
    matchedConnection: null,
  };
}

class StubCredentialStore extends KeychainCredentialStore {
  private readonly credentials = new Map<string, StoredCredential>();

  override create(reference: string, credential: StoredCredential): void {
    this.credentials.set(reference, credential);
  }

  override update(reference: string, credential: StoredCredential): void {
    this.credentials.set(reference, credential);
  }

  override get(reference: string): StoredCredential {
    const credential = this.credentials.get(reference);
    if (!credential) {
      throw new Error(`Missing credential: ${reference}`);
    }
    return credential;
  }

  override remove(reference: string): void {
    this.credentials.delete(reference);
  }
}
