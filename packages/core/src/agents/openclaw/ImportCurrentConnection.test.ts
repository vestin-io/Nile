import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "../../models/access";
import { EndpointRegistry } from "../../models/endpoint";
import { type StoredCredential } from "../../services/credential/Types";
import { KeychainCredentialStore } from "../../services/credential/KeychainCredentialStore";
import { ImportCurrentConnection } from "./ImportCurrentConnection";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("OpenClaw ImportCurrentConnection", () => {
  it("imports an unknown live provider into endpoint/access state", () => {
    const setup = createSetup();
    writeFileSync(
      join(setup.openclawHome, "openclaw.json"),
      JSON.stringify({
        models: {
          mode: "merge",
          providers: {
            imported: {
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
              primary: "imported/gpt-4.1",
            },
          },
        },
      }, null, 2),
      "utf8",
    );

    const importer = ImportCurrentConnection.open(setup.dbPath, {
      openclawHome: setup.openclawHome,
      credentialStore: setup.credentialStore,
    });

    const result = importer.importCurrent();

    expect(result).toEqual({
      id: "gateway-router-example-gpt-4-1",
      label: "Gateway (router.example) gpt-4.1",
      endpointId: "imported",
      endpointLabel: "Gateway (router.example)",
      endpointFamily: "gateway",
      authMode: "api_key",
    });

    const endpoints = EndpointRegistry.open(setup.dbPath);
    expect(endpoints.get("imported")?.rootUrl).toBe("https://router.example");
    endpoints.close();

    const accesses = AccessRegistry.open(setup.dbPath, setup.credentialStore);
    expect(accesses.get("gateway-router-example-gpt-4-1")?.openclawModelId).toBe("gpt-4.1");
    accesses.close();

    importer.close();
  });
});

function createSetup(): {
  dbPath: string;
  openclawHome: string;
  credentialStore: StubCredentialStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-openclaw-import-"));
  tempDirs.push(dir);
  const openclawHome = join(dir, ".openclaw");
  mkdirSync(openclawHome, { recursive: true });

  return {
    dbPath: join(dir, "switcher.sqlite"),
    openclawHome,
    credentialStore: new StubCredentialStore(),
  };
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
