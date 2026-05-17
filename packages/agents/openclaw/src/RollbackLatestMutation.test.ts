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
import { RollbackLatestMutation } from "./RollbackLatestMutation";
import { OPENCLAW_AGENT_ID } from "./types";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("OpenClaw RollbackLatestMutation", () => {
  it("restores the previous openclaw.json and clears the selection when restored state is unknown", () => {
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
    apply.close();

    const rollback = RollbackLatestMutation.open(setup.dbPath, {
      openclawHome: setup.openclawHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });

    rollback.rollback();

    const selection = AgentSelection.open(setup.dbPath);
    expect(selection.get(OPENCLAW_AGENT_ID)).toBeNull();
    selection.close();
    expect(readFileSync(join(setup.openclawHome, "openclaw.json"), "utf8")).toBe(
      '{\n  "models": {\n    "mode": "merge",\n    "providers": {}\n  }\n}\n',
    );

    rollback.close();
  });
});

function createSetup(): {
  dbPath: string;
  openclawHome: string;
  credentialStore: StubCredentialStore;
  secureSnapshots: MemorySecureSnapshotStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-openclaw-rollback-"));
  tempDirs.push(dir);
  const openclawHome = join(dir, ".openclaw");
  mkdirSync(openclawHome, { recursive: true });
  writeFileSync(
    join(openclawHome, "openclaw.json"),
    '{\n  "models": {\n    "mode": "merge",\n    "providers": {}\n  }\n}\n',
    "utf8",
  );

  return {
    dbPath: join(dir, "switcher.sqlite"),
    openclawHome,
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

function seedAccess(
  dbPath: string,
  credentialStore: StubCredentialStore,
  input: {
    id: string;
    endpointId: string;
    label: string;
    authMode: "api_key";
  },
  credential: StoredCredential,
): void {
  const registry = AccessRegistry.open(dbPath, credentialStore);
  registry.add(input, credential);
  registry.close();
}

function setOpenClawModel(dbPath: string, connectionId: string, modelId: string): void {
  const settings = AgentConnectionSettings.open(dbPath);
  try {
    settings.setModelId("openclaw", connectionId, modelId);
  } finally {
    settings.close();
  }
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
