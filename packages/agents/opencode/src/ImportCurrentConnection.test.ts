import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AgentConnectionSettings } from "@nile/core/models/agent-settings";
import { EndpointRegistry } from "@nile/core/models/endpoint";
import { KeychainCredentialStore } from "@nile/core/services/credential";
import type { StoredCredential } from "@nile/core/services/credential";
import { ImportCurrentConnection } from "./ImportCurrentConnection";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("OpenCode ImportCurrentConnection", () => {
  it("imports a live provider from opencode.json", async () => {
    const setup = createSetup();
    writeFileSync(
      join(setup.opencodeHome, "opencode.json"),
      JSON.stringify({
        provider: {
          imported: {
            npm: "@ai-sdk/openai-compatible",
            name: "Router",
            options: {
              baseURL: "https://router.example/v1",
              apiKey: "{env:ROUTER_API_KEY}",
            },
            models: {
              "gpt-4.1": {
                name: "GPT 4.1",
              },
            },
          },
        },
        model: "imported/gpt-4.1",
      }, null, 2),
      "utf8",
    );

    const importer = ImportCurrentConnection.open(setup.dbPath, {
      opencodeHome: setup.opencodeHome,
      credentialStore: setup.credentialStore,
    });

    const result = await importer.importCurrent();

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

    const settings = AgentConnectionSettings.open(setup.dbPath);
    expect(settings.get("opencode", "gateway-router-example-gpt-4-1")?.modelId).toBe("gpt-4.1");
    settings.close();

    importer.close();
  });

  it("imports an official OpenAI oauth setup from auth.json", async () => {
    const setup = createSetup();
    writeFileSync(
      join(setup.opencodeHome, "opencode.json"),
      JSON.stringify({
        model: "openai/gpt-5.1",
      }, null, 2),
      "utf8",
    );
    writeFileSync(
      join(setup.opencodeDataHome, "auth.json"),
      JSON.stringify({
        openai: {
          type: "oauth",
          access: createJwt(1800000000, { sub: "sub_openai" }),
          refresh: "refresh-token",
          expires: 1800000000 * 1000,
          accountId: "acct_openai",
        },
      }, null, 2),
      "utf8",
    );

    const importer = ImportCurrentConnection.open(setup.dbPath, {
      opencodeHome: setup.opencodeHome,
      opencodeDataHome: setup.opencodeDataHome,
      credentialStore: setup.credentialStore,
    });

    const result = await importer.importCurrent();

    expect(result).toEqual({
      id: "openai-session-gpt-5-1",
      label: "OpenAI Session gpt-5.1",
      endpointId: "openai",
      endpointLabel: "OpenAI",
      endpointFamily: "openai",
      authMode: "openai_session",
    });

    const settings = AgentConnectionSettings.open(setup.dbPath);
    expect(settings.get("opencode", "openai-session-gpt-5-1")?.modelId).toBe("gpt-5.1");
    settings.close();

    importer.close();
  });
});

function createSetup(): {
  dbPath: string;
  opencodeHome: string;
  opencodeDataHome: string;
  credentialStore: StubCredentialStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-opencode-import-"));
  tempDirs.push(dir);
  const opencodeHome = join(dir, ".config", "opencode");
  const opencodeDataHome = join(dir, ".local", "share", "opencode");
  mkdirSync(opencodeHome, { recursive: true });
  mkdirSync(opencodeDataHome, { recursive: true });
  return {
    dbPath: join(dir, "switcher.sqlite"),
    opencodeHome,
    opencodeDataHome,
    credentialStore: new StubCredentialStore(),
  };
}

function createJwt(expSeconds: number, claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds, ...claims })).toString("base64url");
  return `${header}.${payload}.`;
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
