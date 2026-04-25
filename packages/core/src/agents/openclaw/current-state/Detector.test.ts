import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "../../../models/access";
import { EndpointRegistry } from "../../../models/endpoint";
import { AgentSelection } from "../../../models/selection/Selection";
import { type StoredCredential } from "../../../services/credential/Types";
import { KeychainCredentialStore } from "../../../services/credential/KeychainCredentialStore";
import { CurrentStateDetector } from "./Detector";
import { OPENCLAW_AGENT_ID } from "../types";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("OpenClaw CurrentStateDetector", () => {
  it("reports a missing local config file instead of a fake schema error", () => {
    const setup = createSetup();
    const detector = CurrentStateDetector.open(setup.dbPath, {
      openclawHome: setup.openclawHome,
      credentialStore: setup.credentialStore,
    });

    const result = detector.detect();

    expect(result.validity).toBe("invalid_structure");
    expect(result.issues).toEqual([
      `OpenClaw config not found at ${join(setup.openclawHome, "openclaw.json")}`,
    ]);

    detector.close();
  });

  it("matches a saved connection when provider, credential, and model hint align", () => {
    const setup = createSetup();
    seedEndpoint(setup.dbPath);
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "router-work",
        endpointId: "gateway",
        label: "Gateway gpt-4.1",
        authMode: "api_key",
        openclawModelId: "gpt-4.1",
      },
      {
        kind: "api_key",
        apiKey: "router-secret",
      },
    );

    const selection = AgentSelection.open(setup.dbPath);
    selection.setApplied(OPENCLAW_AGENT_ID, "router-work", "2026-05-03T00:00:00.000Z");
    selection.close();

    writeFileSync(
      join(setup.openclawHome, "openclaw.json"),
      JSON.stringify({
        models: {
          mode: "merge",
          providers: {
            custom: {
              baseUrl: "https://router.example/v1",
              apiKey: "router-secret",
              api: "openai-responses",
              models: [{ id: "gpt-4.1", name: "GPT 4.1" }],
            },
          },
        },
        agents: {
          defaults: {
            model: {
              primary: "custom/gpt-4.1",
            },
          },
        },
      }, null, 2),
      "utf8",
    );

    const detector = CurrentStateDetector.open(setup.dbPath, {
      openclawHome: setup.openclawHome,
      credentialStore: setup.credentialStore,
    });

    const result = detector.detect();

    expect(result.validity).toBe("valid_matched");
    expect(result.endpoint?.endpointFamily).toBe("gateway");
    expect(result.access?.openclawModelId).toBe("gpt-4.1");
    expect(result.matchedConnection).toEqual({
      connectionId: "router-work",
      endpointId: "gateway",
      accessId: "router-work",
      matchesAgentSelection: true,
    });

    detector.close();
  });
});

function createSetup(): {
  dbPath: string;
  openclawHome: string;
  credentialStore: StubCredentialStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-openclaw-detector-"));
  tempDirs.push(dir);
  const openclawHome = join(dir, ".openclaw");
  mkdirSync(openclawHome, { recursive: true });

  return {
    dbPath: join(dir, "switcher.sqlite"),
    openclawHome,
    credentialStore: new StubCredentialStore(),
  };
}

function seedEndpoint(dbPath: string): void {
  const registry = EndpointRegistry.open(dbPath);
  registry.add({
    id: "gateway",
    label: "Gateway",
    rootUrl: "https://router.example",
    profile: "generic-gateway",
    protocols: {
      openai: {
        basePath: "/v1",
        wireApis: ["responses"],
        authSchemes: ["bearer"],
      },
    },
  });
  registry.close();
}

function seedAccess(
  dbPath: string,
  credentialStore: StubCredentialStore,
  input: {
    id: string;
    endpointId: string;
    label: string;
    authMode: "api_key";
    openclawModelId: string;
  },
  credential: StoredCredential,
): void {
  const registry = AccessRegistry.open(dbPath, credentialStore);
  registry.add(input, credential);
  registry.close();
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
      throw new Error(`Credential not found: ${reference}`);
    }
    return credential;
  }

  override has(reference: string): boolean {
    return this.records.has(reference);
  }

  override remove(reference: string): void {
    this.records.delete(reference);
  }
}
