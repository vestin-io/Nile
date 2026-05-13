import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "../../models/access";
import type {
  AgentAdapter,
  ApplyAgentSelectionResult,
  DetectedAgentState,
  ImportCurrentConnectionResult,
  RollbackLatestAgentResult,
} from "../../models/agent";
import { EndpointRegistry } from "../../models/endpoint";
import { AgentSelection } from "../../models/selection/Selection";
import type { CredentialStore } from "../../services/credential/Store";
import type { StoredCredential } from "../../services/credential/Types";
import { AgentAdapterRegistry } from "../../runtime-local/AgentAdapterRegistry";
import { SelectionSync } from "./SelectionSync";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("SelectionSync", () => {
  it("auto-syncs matched codex selection to the matched saved connection", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new MemoryCredentialStore();
    const endpointRegistry = EndpointRegistry.open(dbPath);
    const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
    const agentSelection = AgentSelection.open(dbPath);
    try {
      seedOpenAiConnection(endpointRegistry, accessRegistry, "jay");
      seedOpenAiConnection(endpointRegistry, accessRegistry, "jiqiang90");
      agentSelection.setApplied("codex", "jay", "2026-05-13T00:00:00.000Z");

      const sync = new SelectionSync(
        agentSelection,
        AgentAdapterRegistry.fromAdapters([
          new StubSelectionAdapter("codex", {
            agentId: "codex",
            validity: "valid_matched",
            issues: [],
            endpoint: {
              endpointFamily: "openai",
              endpointIdHint: "openai",
              labelHint: "OpenAI",
            },
            access: {
              authMode: "openai_session",
              labelHint: "jiqiang90@gmail.com",
            },
            matchedConnection: {
              connectionId: "jiqiang90",
              endpointId: "openai",
              accessId: "jiqiang90",
              matchesAgentSelection: false,
            },
          }),
        ]),
      );

      sync.run(["codex"]);

      expect(agentSelection.get("codex")?.connectionId).toBe("jiqiang90");
    } finally {
      agentSelection.close();
      accessRegistry.close();
      endpointRegistry.close();
    }
  });

  it("does not auto-sync openclaw matched selection", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new MemoryCredentialStore();
    const endpointRegistry = EndpointRegistry.open(dbPath);
    const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
    const agentSelection = AgentSelection.open(dbPath);
    try {
      seedOpenAiConnection(endpointRegistry, accessRegistry, "jay");
      seedOpenAiConnection(endpointRegistry, accessRegistry, "jiqiang90");
      agentSelection.setApplied("openclaw", "jay", "2026-05-13T00:00:00.000Z");

      const sync = new SelectionSync(
        agentSelection,
        AgentAdapterRegistry.fromAdapters([
          new StubSelectionAdapter("openclaw", {
            agentId: "openclaw",
            validity: "valid_matched",
            issues: [],
            endpoint: {
              endpointFamily: "openai",
              endpointIdHint: "openai",
              labelHint: "OpenAI",
            },
            access: {
              authMode: "openai_session",
              labelHint: "jiqiang90@gmail.com",
            },
            matchedConnection: {
              connectionId: "jiqiang90",
              endpointId: "openai",
              accessId: "jiqiang90",
              matchesAgentSelection: false,
            },
          }),
        ]),
      );

      sync.run(["openclaw"]);

      expect(agentSelection.get("openclaw")?.connectionId).toBe("jay");
    } finally {
      agentSelection.close();
      accessRegistry.close();
      endpointRegistry.close();
    }
  });
});

function seedOpenAiConnection(
  endpointRegistry: EndpointRegistry,
  accessRegistry: AccessRegistry,
  connectionId: string,
): void {
  if (!endpointRegistry.get("openai")) {
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
  }
  accessRegistry.add(
    {
      id: connectionId,
      endpointId: "openai",
      label: connectionId,
      authMode: "openai_session",
    },
    {
      kind: "openai_session",
      idToken: `${connectionId}-id`,
      accessToken: `${connectionId}-access`,
      refreshToken: `${connectionId}-refresh`,
      accountId: connectionId,
      lastRefresh: "2026-05-13T00:00:00.000Z",
    },
  );
}

function createTempDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-selection-sync-"));
  tempDirs.push(dir);
  return join(dir, "state.sqlite");
}

class MemoryCredentialStore implements CredentialStore {
  private readonly credentials = new Map<string, StoredCredential>();

  create(reference: string, credential: StoredCredential): void {
    this.credentials.set(reference, credential);
  }

  update(reference: string, credential: StoredCredential): void {
    this.credentials.set(reference, credential);
  }

  get(reference: string): StoredCredential {
    const credential = this.credentials.get(reference);
    if (!credential) {
      throw new Error(`Missing credential: ${reference}`);
    }
    return credential;
  }

  has(reference: string): boolean {
    return this.credentials.has(reference);
  }

  remove(reference: string): void {
    this.credentials.delete(reference);
  }
}

class StubSelectionAdapter implements AgentAdapter {
  readonly rollbackSupport = "no" as const;

  constructor(
    readonly agentId: "codex" | "openclaw",
    private readonly detectedState: DetectedAgentState,
  ) {}

  detectAgentSelection() {
    return {
      agentSelection: null,
      detectedState: this.detectedState,
    };
  }

  applySelection(_connectionId: string): ApplyAgentSelectionResult {
    throw new Error("not implemented");
  }

  async importCurrentConnection(): Promise<ImportCurrentConnectionResult> {
    throw new Error("not implemented");
  }

  rollbackLatestMutation(): RollbackLatestAgentResult {
    throw new Error("not implemented");
  }
}
