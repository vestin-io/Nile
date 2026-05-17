import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "@nile/core/models/access";
import { AgentConnectionSettings } from "@nile/core/models/agent-settings";
import { EndpointRegistry } from "@nile/core/models/endpoint";
import { AgentSelection } from "@nile/core/models/selection";
import { type StoredCredential } from "@nile/core/services/credential";
import { KeychainCredentialStore } from "@nile/core/services/credential";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { SecureSnapshotStore } from "@nile/core/services/history";
import { ApplySelection } from "./ApplySelection";
import { OPENCLAW_AGENT_ID } from "./types";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("OpenClaw ApplySelection", () => {
  it("writes a Nile-managed provider and default model into openclaw.json", () => {
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

    setOpenClawModel(setup.dbPath, "router-work", "gpt-4.1");

    const apply = ApplySelection.open(setup.dbPath, {
      openclawHome: setup.openclawHome,
      credentialStore: setup.credentialStore,
      environment: EnvironmentSource.from({
        ROUTER_WORK_KEY: "router-secret",
      }),
      secureSnapshotStore: setup.secureSnapshots,
    });

    apply.apply("router-work");

    const config = readConfig(setup.openclawHome);
    expect(config.models).toEqual({
      mode: "merge",
      providers: {
        "nile-router-work": {
          api: "openai-responses",
          apiKey: "${ROUTER_WORK_KEY}",
          baseUrl: "https://router.example/v1",
          models: [
            {
              id: "gpt-4.1",
              name: "gpt-4.1",
            },
          ],
        },
      },
    });
    expect(config.agents).toEqual({
      defaults: {
        model: {
          primary: "nile-router-work/gpt-4.1",
          fallbacks: [],
        },
      },
    });

    const selection = AgentSelection.open(setup.dbPath);
    expect(selection.get(OPENCLAW_AGENT_ID)?.connectionId).toBe("router-work");
    selection.close();
    apply.close();
  });

  it("writes official anthropic api keys into the auth-profile store", () => {
    const setup = createSetup();
    seedAnthropicEndpoint(setup.dbPath, "anthropic-work", "Anthropic Work", "https://api.anthropic.com");
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "anthropic-work",
        endpointId: "anthropic-work",
        label: "Anthropic Work",
        authMode: "api_key",
      },
      {
        kind: "api_key",
        source: "env_key",
        envKey: "ANTHROPIC_WORK_KEY",
      },
    );

    setOpenClawModel(setup.dbPath, "anthropic-work", "claude-sonnet-4");

    const apply = ApplySelection.open(setup.dbPath, {
      openclawHome: setup.openclawHome,
      credentialStore: setup.credentialStore,
      environment: EnvironmentSource.from({
        ANTHROPIC_WORK_KEY: "anthropic-secret",
      }),
      secureSnapshotStore: setup.secureSnapshots,
    });

    apply.apply("anthropic-work");

    const config = readConfig(setup.openclawHome);
    expect(config.auth).toEqual({
      profiles: {
        "anthropic:nile-anthropic-work": {
          provider: "anthropic",
          mode: "api_key",
        },
      },
      order: {
        anthropic: ["anthropic:nile-anthropic-work"],
      },
    });
    expect(config.agents.defaults.model).toEqual({
      primary: "anthropic/claude-sonnet-4",
      fallbacks: [],
    });
    expect(config.agents.defaults.models).toEqual({
      "anthropic/claude-sonnet-4": {},
    });

    expect(readAuthProfiles(setup.openclawHome)).toEqual({
      version: 1,
      profiles: {
        "anthropic:nile-anthropic-work": {
          type: "api_key",
          provider: "anthropic",
          key: "anthropic-secret",
        },
      },
    });

    apply.close();
  });

  it("rejects direct api keys to avoid writing secrets into openclaw.json", () => {
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

    setOpenClawModel(setup.dbPath, "router-direct", "gpt-4.1");

    const apply = ApplySelection.open(setup.dbPath, {
      openclawHome: setup.openclawHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });

    expect(() => apply.apply("router-direct")).toThrow(
      "OpenClaw requires an env-backed api_key credential to avoid writing secrets into config files",
    );
    apply.close();
  });

  it("accepts direct api keys when they also carry a readable env key", () => {
    const setup = createSetup();
    seedOpenAiEndpoint(setup.dbPath, "gateway", "Gateway", "https://router.example", "/v1");
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "router-direct-managed",
        endpointId: "gateway",
        label: "Router Direct Managed",
        authMode: "api_key",
      },
      {
        kind: "api_key",
        apiKey: "router-secret",
        envKey: "NILE_ROUTER_DIRECT_MANAGED_API_KEY",
      },
    );

    setOpenClawModel(setup.dbPath, "router-direct-managed", "gpt-4.1");

    const apply = ApplySelection.open(setup.dbPath, {
      openclawHome: setup.openclawHome,
      credentialStore: setup.credentialStore,
      environment: EnvironmentSource.from({
        NILE_ROUTER_DIRECT_MANAGED_API_KEY: "router-secret",
      }),
      secureSnapshotStore: setup.secureSnapshots,
    });

    apply.apply("router-direct-managed");

    const config = readConfig(setup.openclawHome);
    expect(config.models).toEqual({
      mode: "merge",
      providers: {
        "nile-router-direct-managed": {
          api: "openai-responses",
          apiKey: "${NILE_ROUTER_DIRECT_MANAGED_API_KEY}",
          baseUrl: "https://router.example/v1",
          models: [
            {
              id: "gpt-4.1",
              name: "gpt-4.1",
            },
          ],
        },
      },
    });

    apply.close();
  });

  it("writes OpenAI oauth sessions into the auth-profile store", () => {
    const setup = createSetup();
    seedOfficialOpenAiEndpoint(setup.dbPath, "openai", "OpenAI", "https://api.openai.com");
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "openai-session",
        endpointId: "openai",
        label: "OpenAI Session",
        authMode: "openai_session",
      },
      {
        kind: "openai_session",
        idToken: "header.eyJleHAiOjE4MDAwMDAwMDAsImVtYWlsIjoiZ2VtaW5pLnNlY29uZGFyeUBleGFtcGxlLnRlc3QifQ.signature",
        accessToken: "header.eyJleHAiOjE4MDAwMDAwMDB9.signature",
        refreshToken: "refresh-token",
        accountId: "acct-123",
      },
    );

    setOpenClawModel(setup.dbPath, "openai-session", "gpt-5.3-codex");

    const apply = ApplySelection.open(setup.dbPath, {
      openclawHome: setup.openclawHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });

    apply.apply("openai-session");

    const config = readConfig(setup.openclawHome);
    expect(config.auth.profiles["openai-codex:nile-openai-session"]).toEqual({
      provider: "openai-codex",
      mode: "oauth",
      email: "gemini.secondary@example.test",
    });
    expect(config.auth.order["openai-codex"]).toEqual(["openai-codex:nile-openai-session"]);
    expect(config.agents.defaults.model.primary).toBe("openai-codex/gpt-5.3-codex");

    expect(readAuthProfiles(setup.openclawHome)).toEqual({
      version: 1,
      profiles: {
        "openai-codex:nile-openai-session": {
          type: "oauth",
          provider: "openai-codex",
          access: "header.eyJleHAiOjE4MDAwMDAwMDB9.signature",
          refresh: "refresh-token",
          expires: 1800000000000,
          accountId: "acct-123",
          email: "gemini.secondary@example.test",
        },
      },
    });

    apply.close();
  });
});

function createSetup(): {
  dbPath: string;
  openclawHome: string;
  credentialStore: StubCredentialStore;
  secureSnapshots: MemorySecureSnapshotStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-openclaw-apply-"));
  tempDirs.push(dir);
  const openclawHome = join(dir, ".openclaw");
  mkdirSync(openclawHome, { recursive: true });

  return {
    dbPath: join(dir, "switcher.sqlite"),
    openclawHome,
    credentialStore: new StubCredentialStore(),
    secureSnapshots: new MemorySecureSnapshotStore(),
  };
}

function setOpenClawModel(dbPath: string, connectionId: string, modelId: string): void {
  const settings = AgentConnectionSettings.open(dbPath);
  try {
    settings.setModelId("openclaw", connectionId, modelId);
  } finally {
    settings.close();
  }
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

function seedOfficialOpenAiEndpoint(
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
  },
  credential: StoredCredential,
): void {
  const registry = AccessRegistry.open(dbPath, credentialStore);
  registry.add(input, credential);
  registry.close();
}

function readConfig(openclawHome: string): any {
  return JSON.parse(readFileSync(join(openclawHome, "openclaw.json"), "utf8"));
}

function readAuthProfiles(openclawHome: string): any {
  return JSON.parse(
    readFileSync(join(openclawHome, "agents", "main", "agent", "auth-profiles.json"), "utf8"),
  );
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
