import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "@nile/core/models/access";
import { EndpointRegistry } from "@nile/core/models/endpoint";
import { AgentSelection } from "@nile/core/models/selection";
import { type StoredCredential } from "@nile/core/services/credential";
import { KeychainCredentialStore } from "@nile/core/services/credential";
import { SecureSnapshotStore } from "@nile/core/services/history";
import { ApplySelection } from "../apply/ApplySelection";
import { RollbackLatestMutation } from "./RollbackLatestMutation";
import { CODEX_AGENT_ID } from "../types";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("RollbackLatestMutation", () => {
  it("restores the previous live files and clears current selection when the restored state is unknown", () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "openai-official",
      label: "OpenAI Official",
      endpointFamily: "openai",
      supportedAuthModes: ["api_key"],
    });
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "openai-work",
        endpointId: "openai-official",
        label: "OpenAI Work",
        authMode: "api_key",
      },
      { kind: "api_key", apiKey: "secret-openai" },
    );
    seedConnection(setup.dbPath, setup.credentialStore, {
      id: "openai-work-connection",
      endpointId: "openai-official",
      accessId: "openai-work",
      label: "OpenAI Work",
      authMode: "api_key",
    });

    const applySelection = ApplySelection.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });
    applySelection.apply("openai-work-connection");
    applySelection.close();

    const rollback = RollbackLatestMutation.open(setup.dbPath, {
      codexHome: setup.codexHome,
      credentialStore: setup.credentialStore,
      secureSnapshotStore: setup.secureSnapshots,
    });

    rollback.rollback();

    const agentSelection = AgentSelection.open(setup.dbPath);
    expect(agentSelection.get(CODEX_AGENT_ID)).toBeNull();

    agentSelection.close();
    rollback.close();
  });
});

function createSetup(): {
  dbPath: string;
  codexHome: string;
  credentialStore: StubCredentialStore;
  secureSnapshots: MemorySecureSnapshotStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-rollback-latest-"));
  tempDirs.push(dir);

  const codexHome = join(dir, ".codex");
  mkdirSync(codexHome, { recursive: true });
  writeFileSync(join(codexHome, "config.toml"), 'model_provider = "legacy"\n', "utf8");
  writeFileSync(join(codexHome, "auth.json"), '{\n  "OPENAI_API_KEY": "legacy-key"\n}\n', "utf8");

  return {
    dbPath: join(dir, "switcher.sqlite"),
    codexHome,
    credentialStore: new StubCredentialStore(),
    secureSnapshots: new MemorySecureSnapshotStore(),
  };
}

function seedProvider(
  dbPath: string,
  input: {
    id: string;
    label: string;
    endpointFamily?: "openai";
    supportedAuthModes?: Array<"api_key">;
    agentCompatibility?: Array<"codex" | "claude" | "cursor">;
  },
): void {
  const endpointRegistry = EndpointRegistry.open(dbPath);
  endpointRegistry.add({
    id: input.id,
    label: input.label,
    rootUrl: "https://api.openai.com",
    profile: "openai-official",
    protocols: {
      openai: {
        basePath: "/v1",
        wireApis: ["responses"],
        authSchemes: ["bearer"],
        envKeyOverride: "OPENAI_API_KEY",
      },
    },
  });
  endpointRegistry.close();
}

function seedAccess(
  _dbPath: string,
  credentialStore: StubCredentialStore,
  input: {
    id: string;
    endpointId: string;
    label: string;
    authMode: "api_key";
  },
  credential: StoredCredential,
): void {
  credentialStore.create(`access:${input.id}`, credential);
}

function seedConnection(
  dbPath: string,
  credentialStore: StubCredentialStore,
  input: {
    id: string;
    endpointId: string;
    accessId: string;
    label: string;
    authMode: "api_key";
  },
): void {
  const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
  accessRegistry.add({
    id: input.id,
    endpointId: input.endpointId,
    label: input.label,
    authMode: input.authMode,
  }, credentialStore.get(`access:${input.accessId}`));
  accessRegistry.close();
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
    writeFileSync(targetPath, this.snapshots.get(snapshotRef) ?? "", { encoding: "utf8", mode: 0o600 });
  }
}
