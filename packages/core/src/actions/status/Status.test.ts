import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "../../models/access";
import { EndpointRegistry } from "../../models/endpoint";
import { AgentSelection } from "../../models/selection/Selection";
import type { StoredCredential } from "../../services/credential/Types";
import type { CredentialStore } from "../../services/credential/Store";
import { AgentAdapterRegistry } from "../../runtime-local/AgentAdapterRegistry";
import { Status } from "./Status";
import type {
  ApplyAgentSelectionResult,
  DetectedAgentState,
  ImportCurrentConnectionResult,
  RollbackLatestAgentResult,
  AgentAdapter,
  AgentAdapterCapabilities,
  AgentDetectionResult,
} from "../../runtime-local/AgentAdapterTypes";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("Status", () => {
  it("resolves synced status from matched live and current selection", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new MemoryCredentialStore();
    const endpointRegistry = EndpointRegistry.open(dbPath);
    const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
    const agentSelection = AgentSelection.open(dbPath);
    try {
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
          },
        },
      });
      accessRegistry.add(
        {
          id: "work-connection",
          endpointId: "openai",
          label: "Work",
          authMode: "api_key",
        },
        { kind: "api_key", apiKey: "secret" },
      );
      agentSelection.setApplied("codex", "work-connection", "2026-01-01T00:00:00.000Z");

      const manager = new Status(
        endpointRegistry,
        accessRegistry,
        AgentAdapterRegistry.fromAdapters([
          new StubStatusAdapter({
            agentSelection: {
              agentId: "codex",
              connectionId: "work-connection",
              endpointId: "openai",
              accessId: "work-connection",
              appliedAt: "2026-01-01T00:00:00.000Z",
            },
            detectedState: {
              agentId: "codex",
              validity: "valid_matched",
              issues: [],
              endpoint: {
                endpointFamily: "openai",
                endpointIdHint: "openai",
                labelHint: "OpenAI",
              },
              access: {
                authMode: "api_key",
                labelHint: "Work",
              },
              matchedConnection: {
                connectionId: "work-connection",
                endpointId: "openai",
                accessId: "work-connection",
                matchesAgentSelection: true,
              },
            },
          }),
        ]),
      );

      const status = manager.get("codex");

      expect(status.syncState).toBe("synced");
      expect(status.currentConnectionState).toBe("saved");
      expect(status.currentConnection?.id).toBe("work-connection");
      expect(status.liveConnection?.id).toBe("work-connection");
      expect(status.liveIssues).toBeUndefined();
    } finally {
      agentSelection.close();
      accessRegistry.close();
      endpointRegistry.close();
    }
  });

  it("returns invalid_live_state with issues when semantics are invalid", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new MemoryCredentialStore();
    const endpointRegistry = EndpointRegistry.open(dbPath);
    const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
    try {
      const manager = new Status(
        endpointRegistry,
        accessRegistry,
        AgentAdapterRegistry.fromAdapters([
          new StubStatusAdapter({
            agentSelection: null,
            detectedState: {
              agentId: "codex",
              validity: "invalid_semantics",
              issues: ["missing auth"],
              endpoint: null,
              access: null,
              matchedConnection: null,
            },
          }),
        ]),
      );

      const status = manager.get("codex");

      expect(status.syncState).toBe("invalid_live_state");
      expect(status.currentConnectionState).toBe("none");
      expect(status.liveConnection).toBeNull();
      expect(status.liveIssues).toEqual(["missing auth"]);
    } finally {
      accessRegistry.close();
      endpointRegistry.close();
    }
  });

  it("keeps orphaned current selection visible after the saved connection is removed", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new MemoryCredentialStore();
    const endpointRegistry = EndpointRegistry.open(dbPath);
    const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
    const agentSelection = AgentSelection.open(dbPath);
    let orphanEndpointRegistry: EndpointRegistry | null = null;
    let orphanAccessRegistry: AccessRegistry | null = null;
    try {
      endpointRegistry.add({
        id: "azure",
        label: "Azure",
        rootUrl: "https://example.cognitiveservices.azure.com",
        profile: "azure-openai",
        protocols: {
          openai: {
            basePath: "/openai/v1",
            wireApis: ["responses"],
            authSchemes: ["bearer"],
          },
        },
      });
      accessRegistry.add(
        {
          id: "azure-connection",
          endpointId: "azure",
          label: "Azure API Key",
          authMode: "api_key",
        },
        { kind: "api_key", apiKey: "secret" },
      );
      agentSelection.setApplied("codex", "azure-connection", "2026-01-01T00:00:00.000Z");
      accessRegistry.remove("azure-connection");

      orphanEndpointRegistry = EndpointRegistry.open(dbPath);
      orphanAccessRegistry = AccessRegistry.open(dbPath, credentialStore);
      const manager = new Status(
        orphanEndpointRegistry,
        orphanAccessRegistry,
        AgentAdapterRegistry.fromAdapters([
          new StubStatusAdapter({
            agentSelection: {
              agentId: "codex",
              connectionId: "azure-connection",
              endpointId: "azure",
              accessId: "azure-connection",
              appliedAt: "2026-01-01T00:00:00.000Z",
            },
            detectedState: {
              agentId: "codex",
              validity: "invalid_structure",
              issues: ["not configured"],
              endpoint: null,
              access: null,
              matchedConnection: null,
            },
          }),
        ]),
      );

      const status = manager.get("codex");

      expect(status.currentConnection).toEqual({
        id: "azure-connection",
        label: "azure-connection",
        appliedAt: "2026-01-01T00:00:00.000Z",
        endpointId: "azure",
        endpointLabel: "Azure",
        endpointFamily: "unknown",
        authMode: "unknown",
      });
      expect(status.currentConnectionState).toBe("orphaned");
      expect(status.liveConnection).toBeNull();
      expect(status.syncState).toBe("invalid_live_state");
    } finally {
      orphanEndpointRegistry?.close();
      orphanAccessRegistry?.close();
      agentSelection.close();
      accessRegistry.close();
      endpointRegistry.close();
    }
  });
});

function createTempDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-agent-status-manager-"));
  tempDirs.push(dir);
  return join(dir, "switcher.sqlite");
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

class StubStatusAdapter implements AgentAdapter {
  readonly agentId = "codex" as const;
  readonly capabilities: AgentAdapterCapabilities = {
    detect: "yes",
    apply: "yes",
    import: "yes",
    history: "no",
    rollback: "yes",
    desktopSupport: "no",
  };

  constructor(private readonly detection: AgentDetectionResult) {}

  detectCurrentState(): DetectedAgentState {
    return this.detection.detectedState;
  }
  detectAgentSelection(): AgentDetectionResult {
    return this.detection;
  }
  applySelection(_connectionId: string): ApplyAgentSelectionResult {
    throw new Error("not used");
  }
  importCurrentConnection(): ImportCurrentConnectionResult {
    throw new Error("not used");
  }
  rollbackLatestMutation(): RollbackLatestAgentResult {
    throw new Error("not used");
  }
}
