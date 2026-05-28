import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "@nile/core/models/access";
import { AgentConnectionSettings } from "@nile/core/models/agent-settings";
import { EndpointRegistry } from "@nile/core/models/endpoint";
import { AgentSelection } from "@nile/core/models/selection";
import { KeychainCredentialStore } from "@nile/core/services/credential";
import type { StoredCredential } from "@nile/core/services/credential";
import { LiveSetupDetector } from "./Detector";
import { OPENCODE_AGENT_ID } from "../types";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("OpenCode LiveSetupDetector", () => {
  it("reports a missing config file", () => {
    const setup = createSetup(false);
    const detector = LiveSetupDetector.open(setup.dbPath, {
      opencodeHome: setup.opencodeHome,
      credentialStore: setup.credentialStore,
    });

    const result = detector.detect();

    expect(result.validity).toBe("invalid_structure");
    expect(result.issues).toEqual([
      `OpenCode config not found at ${join(setup.opencodeHome, "opencode.json")}`,
    ]);

    detector.close();
  });

  it("matches a saved connection when provider and model align", () => {
    const setup = createSetup(true);
    seedEndpoint(setup.dbPath);
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "router-work",
        endpointId: "gateway",
        label: "Gateway gpt-4.1",
        authMode: "api_key",
      },
      {
        kind: "api_key",
        source: "env_key",
        envKey: "ROUTER_WORK_KEY",
      },
    );
    setModel(setup.dbPath, "router-work", "gpt-4.1");

    const selection = AgentSelection.open(setup.dbPath);
    selection.setApplied(OPENCODE_AGENT_ID, "router-work", "2026-05-03T00:00:00.000Z");
    selection.close();

    writeFileSync(
      join(setup.opencodeHome, "opencode.json"),
      JSON.stringify({
        provider: {
          imported: {
            npm: "@ai-sdk/openai-compatible",
            options: {
              baseURL: "https://router.example/v1",
              apiKey: "{env:ROUTER_WORK_KEY}",
            },
            models: {
              "gpt-4.1": { name: "GPT 4.1" },
            },
          },
        },
        model: "imported/gpt-4.1",
      }, null, 2),
      "utf8",
    );

    const detector = LiveSetupDetector.open(setup.dbPath, {
      opencodeHome: setup.opencodeHome,
      credentialStore: setup.credentialStore,
    });

    const result = detector.detect();

    expect(result.validity).toBe("valid_matched");
    expect(result.endpoint?.endpointFamily).toBe("gateway");
    expect(result.modelId).toBe("gpt-4.1");
    expect(result.matchedConnection).toEqual({
      connectionId: "router-work",
      endpointId: "gateway",
      accessId: "router-work",
      matchesAgentSelection: true,
    });

    detector.close();
  });

  it("matches a saved OpenAI session when the official auth store is active", () => {
    const setup = createSetup(true);
    seedOfficialOpenAiEndpoint(setup.dbPath);
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "openai-session",
        endpointId: "openai",
        label: "OpenAI Session gpt-5.1",
        authMode: "openai_session",
        identityKey: "account:acct_openai",
      },
      {
        kind: "openai_session",
        accountId: "acct_openai",
        idToken: createJwt(1800000000, { sub: "sub_openai" }),
        accessToken: createJwt(1800000000, { sub: "sub_openai" }),
        refreshToken: "refresh-token",
      },
    );
    setModel(setup.dbPath, "openai-session", "gpt-5.1");

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

    const detector = LiveSetupDetector.open(setup.dbPath, {
      opencodeHome: setup.opencodeHome,
      opencodeDataHome: setup.opencodeDataHome,
      credentialStore: setup.credentialStore,
    });

    const result = detector.detect();

    expect(result.validity).toBe("valid_matched");
    expect(result.access?.authMode).toBe("openai_session");
    expect(result.endpoint?.endpointFamily).toBe("openai");
    expect(result.modelId).toBe("gpt-5.1");
    expect(result.matchedConnection).toEqual({
      connectionId: "openai-session",
      endpointId: "openai",
      accessId: "openai-session",
      matchesAgentSelection: false,
    });

    detector.close();
  });

  it("reports conflicting built-in agent model overrides as invalid semantics", () => {
    const setup = createSetup(true);
    writeFileSync(
      join(setup.opencodeHome, "opencode.json"),
      JSON.stringify({
        model: "openai/gpt-5.1",
        enabled_providers: ["openai"],
        agent: {
          build: {
            model: "azure/gpt-5.2-codex",
          },
        },
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
        },
      }, null, 2),
      "utf8",
    );

    const detector = LiveSetupDetector.open(setup.dbPath, {
      opencodeHome: setup.opencodeHome,
      opencodeDataHome: setup.opencodeDataHome,
      credentialStore: setup.credentialStore,
    });

    const result = detector.detect();

    expect(result.validity).toBe("invalid_semantics");
    expect(result.issues).toEqual([
      "OpenCode agent.build.model overrides the selected model with azure/gpt-5.2-codex",
    ]);

    detector.close();
  });
});

function createSetup(withHome: boolean): {
  dbPath: string;
  opencodeHome: string;
  opencodeDataHome: string;
  credentialStore: StubCredentialStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-opencode-detector-"));
  tempDirs.push(dir);
  const opencodeHome = join(dir, ".config", "opencode");
  const opencodeDataHome = join(dir, ".local", "share", "opencode");
  if (withHome) {
    mkdirSync(opencodeHome, { recursive: true });
    mkdirSync(opencodeDataHome, { recursive: true });
  }
  return {
    dbPath: join(dir, "switcher.sqlite"),
    opencodeHome,
    opencodeDataHome,
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
        wireApis: ["chat"],
        authSchemes: ["bearer"],
      },
    },
  });
  registry.close();
}

function seedOfficialOpenAiEndpoint(dbPath: string): void {
  const registry = EndpointRegistry.open(dbPath);
  registry.add({
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
  registry.close();
}

function seedAccess(
  dbPath: string,
  credentialStore: StubCredentialStore,
  input: {
    id: string;
    endpointId: string;
    label: string;
    authMode: "api_key" | "openai_session";
    identityKey?: string;
  },
  credential: StoredCredential,
): void {
  const registry = AccessRegistry.open(dbPath, credentialStore);
  registry.add(input, credential);
  registry.close();
}

function setModel(dbPath: string, connectionId: string, modelId: string): void {
  const settings = AgentConnectionSettings.open(dbPath);
  settings.setModelId("opencode", connectionId, modelId);
  settings.close();
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
