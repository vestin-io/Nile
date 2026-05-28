import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "@nile/core/models/access";
import { AgentConnectionSettings } from "@nile/core/models/agent-settings";
import { EndpointRegistry } from "@nile/core/models/endpoint";
import { AgentSelection } from "@nile/core/models/selection";
import type { StoredCredential } from "@nile/core/services/credential";
import { KeychainCredentialStore } from "@nile/core/services/credential";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { SecureSnapshotStore } from "@nile/core/services/history";
import { ApplySelection } from "./ApplySelection";
import { OPENCODE_AGENT_ID } from "./types";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("OpenCode ApplySelection", () => {
  it("writes a Nile-managed provider and top-level model into opencode.json", () => {
    const setup = createSetup();
    seedOpenAiEndpoint(setup.dbPath, "gateway", "Gateway", "https://router.example", "/v1");
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "router-work",
        endpointId: "gateway",
        label: "Router Work",
        authMode: "api_key",
      },
      {
        kind: "api_key",
        source: "env_key",
        envKey: "ROUTER_WORK_KEY",
      },
    );
    setModel(setup.dbPath, "router-work", "gpt-4.1");

    const apply = ApplySelection.open(setup.dbPath, {
      opencodeHome: setup.opencodeHome,
      credentialStore: setup.credentialStore,
      environment: EnvironmentSource.from({
        ROUTER_WORK_KEY: "router-secret",
      }),
      secureSnapshotStore: setup.secureSnapshots,
    });

    apply.apply("router-work");

    expect(readConfig(setup.opencodeHome)).toEqual({
      agent: {
        build: { model: "nile-router-work/gpt-4.1" },
        general: { model: "nile-router-work/gpt-4.1" },
        plan: { model: "nile-router-work/gpt-4.1" },
      },
      enabled_providers: ["nile-router-work"],
      provider: {
        "nile-router-work": {
          npm: "@ai-sdk/openai-compatible",
          name: "Gateway",
          options: {
            apiKey: "{env:ROUTER_WORK_KEY}",
            baseURL: "https://router.example/v1",
          },
          models: {
            "gpt-4.1": {
              name: "gpt-4.1",
            },
          },
        },
      },
      model: "nile-router-work/gpt-4.1",
    });

    const selection = AgentSelection.open(setup.dbPath);
    expect(selection.get(OPENCODE_AGENT_ID)?.connectionId).toBe("router-work");
    selection.close();
    apply.close();
  });

  it("writes official Anthropic providers using the AI SDK anthropic package", () => {
    const setup = createSetup();
    seedAnthropicEndpoint(setup.dbPath, "anthropic", "Anthropic", "https://api.anthropic.com");
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "anthropic-work",
        endpointId: "anthropic",
        label: "Anthropic Work",
        authMode: "api_key",
      },
      {
        kind: "api_key",
        apiKey: "anthropic-secret",
        envKey: "NILE_ANTHROPIC_WORK_API_KEY",
      },
    );
    setModel(setup.dbPath, "anthropic-work", "claude-sonnet-4");

    const apply = ApplySelection.open(setup.dbPath, {
      opencodeHome: setup.opencodeHome,
      credentialStore: setup.credentialStore,
      environment: EnvironmentSource.from({
        NILE_ANTHROPIC_WORK_API_KEY: "anthropic-secret",
      }),
      secureSnapshotStore: setup.secureSnapshots,
    });

    apply.apply("anthropic-work");

    expect(readConfig(setup.opencodeHome)).toEqual({
      agent: {
        build: { model: "nile-anthropic-work/claude-sonnet-4" },
        general: { model: "nile-anthropic-work/claude-sonnet-4" },
        plan: { model: "nile-anthropic-work/claude-sonnet-4" },
      },
      enabled_providers: ["nile-anthropic-work"],
      provider: {
        "nile-anthropic-work": {
          npm: "@ai-sdk/anthropic",
          name: "Anthropic",
          options: {
            apiKey: "{env:NILE_ANTHROPIC_WORK_API_KEY}",
          },
          models: {
            "claude-sonnet-4": {
              name: "claude-sonnet-4",
            },
          },
        },
      },
      model: "nile-anthropic-work/claude-sonnet-4",
    });

    apply.close();
  });

  it("writes official OpenAI sessions into OpenCode auth.json and switches the top-level model", () => {
    const setup = createSetup();
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
        idToken: createJwt(1800000000, { email: "session@example.com", sub: "sub_openai" }),
        accessToken: createJwt(1800000000, { sub: "sub_openai" }),
        refreshToken: "refresh-token",
      },
    );
    setModel(setup.dbPath, "openai-session", "gpt-5.1");

    const apply = ApplySelection.open(setup.dbPath, {
      opencodeHome: setup.opencodeHome,
      opencodeDataHome: setup.opencodeDataHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });

    apply.apply("openai-session");

    expect(readConfig(setup.opencodeHome)).toEqual({
      agent: {
        build: { model: "openai/gpt-5.1" },
        general: { model: "openai/gpt-5.1" },
        plan: { model: "openai/gpt-5.1" },
      },
      enabled_providers: ["openai"],
      model: "openai/gpt-5.1",
    });
    expect(readAuth(setup.opencodeDataHome)).toEqual({
      openai: {
        type: "oauth",
        access: createJwt(1800000000, { sub: "sub_openai" }),
        refresh: "refresh-token",
        expires: 1800000000 * 1000,
        accountId: "acct_openai",
      },
    });

    apply.close();
  });

  it("rejects direct api keys without an env key", () => {
    const setup = createSetup();
    seedOpenAiEndpoint(setup.dbPath, "gateway", "Gateway", "https://router.example", "/v1");
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "router-direct",
        endpointId: "gateway",
        label: "Router Direct",
        authMode: "api_key",
      },
      {
        kind: "api_key",
        apiKey: "router-secret",
      },
    );
    setModel(setup.dbPath, "router-direct", "gpt-4.1");

    const apply = ApplySelection.open(setup.dbPath, {
      opencodeHome: setup.opencodeHome,
      opencodeDataHome: setup.opencodeDataHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });

    expect(() => apply.apply("router-direct")).toThrow(
      "OpenCode requires an env-backed api_key credential to avoid writing secrets into config files",
    );
    apply.close();
  });
});

function createSetup(): {
  dbPath: string;
  opencodeHome: string;
  opencodeDataHome: string;
  credentialStore: StubCredentialStore;
  secureSnapshots: MemorySecureSnapshotStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-opencode-apply-"));
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
    secureSnapshots: new MemorySecureSnapshotStore(),
  };
}

function seedOpenAiEndpoint(
  dbPath: string,
  id: string,
  label: string,
  rootUrl: string,
  basePath: string,
): void {
  const registry = EndpointRegistry.open(dbPath);
  registry.add({
    id,
    label,
    rootUrl,
    profile: "generic-gateway",
    protocols: {
      openai: {
        basePath,
        wireApis: ["responses"],
        authSchemes: ["bearer"],
      },
    },
  });
  registry.close();
}

function seedAnthropicEndpoint(
  dbPath: string,
  id: string,
  label: string,
  rootUrl: string,
): void {
  const registry = EndpointRegistry.open(dbPath);
  registry.add({
    id,
    label,
    rootUrl,
    profile: "anthropic-official",
    protocols: {
      anthropic: {
        authSchemes: ["x_api_key"],
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

function readConfig(opencodeHome: string): unknown {
  return JSON.parse(readFileSync(join(opencodeHome, "opencode.json"), "utf8")) as unknown;
}

function readAuth(opencodeDataHome: string): unknown {
  return JSON.parse(readFileSync(join(opencodeDataHome, "auth.json"), "utf8")) as unknown;
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

class MemorySecureSnapshotStore extends SecureSnapshotStore {
  private readonly snapshots = new Map<string, string>();

  override writeBeforeSnapshot(snapshotRef: string, content: string | null) {
    this.snapshots.set(snapshotRef, content ?? "");
    return {
      snapshotRef,
      checksum: this.checksum(content),
    };
  }

  override restoreSnapshot(snapshotRef: string, targetPath: string, existedBefore: boolean): void {
    if (!existedBefore) {
      rmSync(targetPath, { force: true });
      return;
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, this.snapshots.get(snapshotRef) ?? "", {
      encoding: "utf8",
      mode: 0o600,
    });
  }
}
