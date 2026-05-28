import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "@nile/core/models/access";
import { AgentConnectionSettings } from "@nile/core/models/agent-settings";
import { EndpointRegistry } from "@nile/core/models/endpoint";
import { AgentSelection } from "@nile/core/models/selection";
import { KeychainCredentialStore } from "@nile/core/services/credential";
import type { StoredCredential } from "@nile/core/services/credential";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { SecureSnapshotStore } from "@nile/core/services/history";
import { ApplySelection } from "./ApplySelection";
import { RollbackLatestMutation } from "./RollbackLatestMutation";
import { OPENCODE_AGENT_ID } from "./types";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("OpenCode RollbackLatestMutation", () => {
  it("restores the previous opencode.json and clears the selection when restored state is unknown", () => {
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
      opencodeDataHome: setup.opencodeDataHome,
      credentialStore: setup.credentialStore,
      environment: EnvironmentSource.from({
        ROUTER_WORK_KEY: "router-secret",
      }),
      secureSnapshotStore: setup.secureSnapshots,
    });
    apply.apply("router-work");
    apply.close();

    const rollback = RollbackLatestMutation.open(setup.dbPath, {
      opencodeHome: setup.opencodeHome,
      opencodeDataHome: setup.opencodeDataHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });

    rollback.rollback();

    const selection = AgentSelection.open(setup.dbPath);
    expect(selection.get(OPENCODE_AGENT_ID)).toBeNull();
    selection.close();
    expect(readFileSync(join(setup.opencodeHome, "opencode.json"), "utf8")).toBe("{\n  \"provider\": {}\n}\n");

    rollback.close();
  });

  it("restores auth.json after rolling back an OpenAI session apply", () => {
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
        idToken: createJwt(1800000000, { sub: "sub_openai" }),
        accessToken: createJwt(1800000000, { sub: "sub_openai" }),
        refreshToken: "refresh-token",
      },
    );
    setModel(setup.dbPath, "openai-session", "gpt-5.1");
    writeFileSync(
      join(setup.opencodeDataHome, "auth.json"),
      JSON.stringify({
        openai: {
          type: "oauth",
          access: "old-access",
          refresh: "old-refresh",
          expires: 1700000000000,
        },
      }, null, 2) + "\n",
      "utf8",
    );

    const apply = ApplySelection.open(setup.dbPath, {
      opencodeHome: setup.opencodeHome,
      opencodeDataHome: setup.opencodeDataHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });
    apply.apply("openai-session");
    apply.close();

    const rollback = RollbackLatestMutation.open(setup.dbPath, {
      opencodeHome: setup.opencodeHome,
      opencodeDataHome: setup.opencodeDataHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });

    rollback.rollback();

    expect(readFileSync(join(setup.opencodeDataHome, "auth.json"), "utf8")).toBe(
      '{\n  "openai": {\n    "type": "oauth",\n    "access": "old-access",\n    "refresh": "old-refresh",\n    "expires": 1700000000000\n  }\n}\n',
    );

    rollback.close();
  });
});

function createSetup(): {
  dbPath: string;
  opencodeHome: string;
  opencodeDataHome: string;
  credentialStore: StubCredentialStore;
  secureSnapshots: MemorySecureSnapshotStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-opencode-rollback-"));
  tempDirs.push(dir);
  const opencodeHome = join(dir, ".config", "opencode");
  const opencodeDataHome = join(dir, ".local", "share", "opencode");
  mkdirSync(opencodeHome, { recursive: true });
  mkdirSync(opencodeDataHome, { recursive: true });
  writeFileSync(join(opencodeHome, "opencode.json"), "{\n  \"provider\": {}\n}\n", "utf8");

  return {
    dbPath: join(dir, "switcher.sqlite"),
    opencodeHome,
    opencodeDataHome,
    credentialStore: new StubCredentialStore(),
    secureSnapshots: new MemorySecureSnapshotStore(),
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
