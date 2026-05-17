import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AccessRegistry } from "../../models/access";
import type { DetectedAgentState } from "../../models/agent";
import { AgentConnectionSettings } from "../../models/agent-settings";
import { EndpointRegistry } from "../../models/endpoint";
import { AgentSelection } from "../../models/selection/Selection";
import type { GatewayCapabilityProbe, GatewayProbeResult } from "../../models/connection";
import { KeychainCredentialStore } from "../../services/credential/KeychainCredentialStore";
import type { StoredCredential } from "../../services/credential/Types";
import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import { NileLogger } from "../../services/NileLogger";
import { LiveSetupImportSupport } from "./Import";

const tempDirs: string[] = [];

describe("LiveSetupImportSupport", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
  });

  it("merges imported agent protocol capabilities into an existing same-url endpoint", async () => {
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
    const support = new LiveSetupImportSupport(
      "claude",
      "Claude",
      setup.endpointRegistry,
      setup.accessRegistry,
      setup.agentSelection,
      setup.agentConnectionSettings,
      NileLogger.silent(),
    );

    try {
      const result = await support.importDetected(createDetectedClaudeGatewayState(), () => ({
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
          enabledAgents: ["claude", "openclaw"],
        }),
      );
    } finally {
      setup.database.close();
    }
  });

  it("reuses an existing same-key access and adds the imported agent", async () => {
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
    const support = new LiveSetupImportSupport(
      "claude",
      "Claude",
      setup.endpointRegistry,
      setup.accessRegistry,
      setup.agentSelection,
      setup.agentConnectionSettings,
      NileLogger.silent(),
    );

    try {
      const result = await support.importDetected(createDetectedClaudeGatewayState(), () => ({
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
          enabledAgents: ["codex", "claude", "openclaw"],
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

  it("refreshes a matched gateway connection without overwriting connection metadata", async () => {
    const setup = createSetup();
    setup.endpointRegistry.add({
      id: "gateway-gateway-example-test",
      label: "Gateway (gateway.example.test)",
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
    });
    setup.accessRegistry.add({
      id: "gateway-key",
      endpointId: "gateway-gateway-example-test",
      label: "Custom Gateway Label",
      authMode: "api_key",
      enabledAgents: ["claude"],
    }, {
      kind: "api_key",
      source: "direct",
      apiKey: "secret",
    });
    const support = new LiveSetupImportSupport(
      "claude",
      "Claude",
      setup.endpointRegistry,
      setup.accessRegistry,
      setup.agentSelection,
      setup.agentConnectionSettings,
      NileLogger.silent(),
      new StubGatewayProbe({
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
      }),
    );

    try {
      const result = await support.importDetected({
        ...createDetectedClaudeGatewayState(),
        validity: "valid_matched",
        matchedConnection: {
          connectionId: "gateway-key",
          endpointId: "gateway-gateway-example-test",
          accessId: "gateway-key",
          matchesAgentSelection: true,
        },
      }, () => ({
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
          label: "Gateway Key",
          authMode: "api_key",
        },
        credential: {
          kind: "api_key",
          source: "direct",
          apiKey: "secret",
        },
        modelId: "claude-sonnet-4.5",
      }));

      expect(result).toEqual(
        expect.objectContaining({
          id: "gateway-key",
          endpointId: "gateway-gateway-example-test",
          reused: true,
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
      expect(setup.accessRegistry.get("gateway-key")).toEqual(
        expect.objectContaining({
          label: "Custom Gateway Label",
          enabledAgents: ["claude", "codex", "openclaw"],
        }),
      );
      expect(setup.endpointRegistry.get("gateway-gateway-example-test")).toEqual(
        expect.objectContaining({
          label: "Gateway (gateway.example.test)",
          rootUrl: "https://gateway.example.test",
          profile: "generic-gateway",
        }),
      );
      expect(setup.agentConnectionSettings.get("claude", "gateway-key")?.modelId).toBe("claude-sonnet-4.5");
    } finally {
      setup.database.close();
    }
  });

  it("clears a previously saved model when the current setup has no model", async () => {
    const setup = createSetup();
    setup.endpointRegistry.add({
      id: "gateway-gateway-example-test",
      label: "Gateway (gateway.example.test)",
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
    });
    setup.accessRegistry.add({
      id: "gateway-key",
      endpointId: "gateway-gateway-example-test",
      label: "Gateway Key",
      authMode: "api_key",
      enabledAgents: ["claude"],
    }, {
      kind: "api_key",
      source: "direct",
      apiKey: "secret",
    });
    setup.agentConnectionSettings.setModelId("claude", "gateway-key", "claude-sonnet-4.5");
    const support = new LiveSetupImportSupport(
      "claude",
      "Claude",
      setup.endpointRegistry,
      setup.accessRegistry,
      setup.agentSelection,
      setup.agentConnectionSettings,
      NileLogger.silent(),
    );

    try {
      await support.importDetected({
        ...createDetectedClaudeGatewayState(),
        validity: "valid_matched",
        matchedConnection: {
          connectionId: "gateway-key",
          endpointId: "gateway-gateway-example-test",
          accessId: "gateway-key",
          matchesAgentSelection: true,
        },
      }, () => ({
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
          label: "Gateway Key",
          authMode: "api_key",
        },
        credential: {
          kind: "api_key",
          source: "direct",
          apiKey: "secret",
        },
      }));

      expect(setup.agentConnectionSettings.get("claude", "gateway-key")).toBeNull();
    } finally {
      setup.database.close();
    }
  });

  it("preserves an existing env-backed api-key credential when a matched save sees a direct local key", async () => {
    const setup = createSetup();
    setup.endpointRegistry.add({
      id: "gateway-gateway-example-test",
      label: "Gateway (gateway.example.test)",
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
    });
    setup.accessRegistry.add({
      id: "gateway-key",
      endpointId: "gateway-gateway-example-test",
      label: "Gateway Key",
      authMode: "api_key",
      enabledAgents: ["claude"],
    }, {
      kind: "api_key",
      source: "env_key",
      envKey: "NILE_GATEWAY_KEY",
    });
    const support = new LiveSetupImportSupport(
      "claude",
      "Claude",
      setup.endpointRegistry,
      setup.accessRegistry,
      setup.agentSelection,
      setup.agentConnectionSettings,
      NileLogger.silent(),
    );

    try {
      await support.importDetected({
        ...createDetectedClaudeGatewayState(),
        validity: "valid_matched",
        matchedConnection: {
          connectionId: "gateway-key",
          endpointId: "gateway-gateway-example-test",
          accessId: "gateway-key",
          matchesAgentSelection: true,
        },
      }, () => ({
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
          label: "Gateway Key",
          authMode: "api_key",
        },
        credential: {
          kind: "api_key",
          source: "direct",
          apiKey: "secret",
        },
      }));

      expect(setup.accessRegistry.get("gateway-key")).toEqual(
        expect.objectContaining({
          apiKeySource: "env_key",
          envKey: "NILE_GATEWAY_KEY",
        }),
      );
      expect(setup.accessRegistry.readCredential("gateway-key")).toEqual({
        kind: "api_key",
        source: "env_key",
        envKey: "NILE_GATEWAY_KEY",
      });
    } finally {
      setup.database.close();
    }
  });

  it("enables OpenClaw when importing an official session-backed provider", async () => {
    const setup = createSetup();
    const support = new LiveSetupImportSupport(
      "claude",
      "Claude",
      setup.endpointRegistry,
      setup.accessRegistry,
      setup.agentSelection,
      setup.agentConnectionSettings,
      NileLogger.silent(),
    );

    try {
      const result = await support.importDetected({
        agentId: "claude",
        validity: "valid_import_candidate",
        issues: [],
        matchedConnection: null,
        endpoint: {
          endpointFamily: "anthropic",
          endpointIdHint: "claude",
          labelHint: "Claude",
          baseUrl: "https://api.anthropic.com",
        },
        access: {
          authMode: "claude_session",
          identityKey: "account:org-123:user-123",
          labelHint: "work@example.com",
        },
      }, () => ({
        endpoint: {
          id: "claude",
          label: "Claude",
          rootUrl: "https://api.anthropic.com",
          profile: "anthropic-official",
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
          label: "work@example.com",
          authMode: "claude_session",
          identityKey: "account:org-123:user-123",
        },
        credential: {
          kind: "claude_session",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          organizationUuid: "org-123",
          accountUuid: "user-123",
          email: "work@example.com",
        },
      }));

      expect(result).toEqual(
        expect.objectContaining({
          endpointFamily: "anthropic",
          authMode: "claude_session",
        }),
      );
      expect(setup.accessRegistry.get(result.id)).toEqual(
        expect.objectContaining({
          enabledAgents: ["claude", "openclaw"],
        }),
      );
    } finally {
      setup.database.close();
    }
  });

  it("re-probes generic gateway api-key imports and enables compatible agents", async () => {
    const setup = createSetup();
    const support = new LiveSetupImportSupport(
      "claude",
      "Claude",
      setup.endpointRegistry,
      setup.accessRegistry,
      setup.agentSelection,
      setup.agentConnectionSettings,
      NileLogger.silent(),
      new StubGatewayProbe({
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
      }),
    );

    try {
      const result = await support.importDetected(createDetectedClaudeGatewayState(), () => ({
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

      expect(result.endpointFamily).toBe("gateway");
      expect(setup.accessRegistry.get(result.id)?.enabledAgents).toEqual(["codex", "claude", "openclaw"]);
      expect(setup.endpointRegistry.get(result.endpointId)?.protocols).toEqual({
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
  agentConnectionSettings: AgentConnectionSettings;
} {
  const root = mkdtempSync(join(tmpdir(), "nile-live-setup-import-"));
  tempDirs.push(root);
  const database = SqliteDatabase.open(join(root, "switcher.sqlite"));
  const endpointRegistry = EndpointRegistry.fromDatabase(database);
  const accessRegistry = AccessRegistry.fromDatabase(database, new StubCredentialStore());
  const agentSelection = AgentSelection.fromDatabase(database);
  const agentConnectionSettings = AgentConnectionSettings.fromDatabase(database);
  return {
    database,
    endpointRegistry,
    accessRegistry,
    agentSelection,
    agentConnectionSettings,
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

class StubGatewayProbe implements GatewayCapabilityProbe {
  constructor(private readonly result: GatewayProbeResult) {}

  async probe(): Promise<GatewayProbeResult> {
    return this.result;
  }
}
