import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SqliteDatabase } from "../database/SqliteDatabase";
import { AccessRegistry } from "../../models/access";
import { EndpointRegistry } from "../../models/endpoint";
import { AgentSelection } from "../../models/selection/Selection";
import { AgentConnectionSettings } from "../../models/agent-settings";
import { SavedConnections } from "../../models/connection";
import type { CreateConnectionInput } from "../../models/connection";
import type { CredentialStore, CredentialStoreTarget } from "./Store";
import type { StoredCredential } from "./Types";
import { PortableBundleCodec } from "./PortableBundleCodec";
import { PortableBundleExport } from "./PortableExport";
import { PortableBundleImport } from "./PortableImport";
import { PORTABLE_CONNECTION_IDENTITY } from "./PortableIdentity";
import { normalizeCredentialStoreTarget } from "./Store";
import type { PortableBundlePayload } from "./PortableBundleTypes";

const tempRoots: string[] = [];

describe("Portable bundle workflows", () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      rmSync(tempRoots.pop()!, { recursive: true, force: true });
    }
  });

  it("exports saved connections with identity, selections, and model settings", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new MemoryCredentialStore();
    createOpenAiConnection({
      dbPath,
      credentialStore,
      id: "acct-123",
      label: "primary@example.com",
      backend: "encrypted_local_storage",
      identityKey: "account:acct_123",
      credential: {
        kind: "openai_session",
        accountId: "acct_123",
        idToken: "id",
        accessToken: "access",
        refreshToken: "refresh",
      },
      enabledAgents: ["codex", "openclaw"],
    });

    const selection = AgentSelection.open(dbPath);
    selection.setApplied("codex", "acct-123");
    selection.close();

    const settings = AgentConnectionSettings.open(dbPath);
    settings.setModelId("openclaw", "acct-123", "gpt-5.3-codex");
    settings.close();

    const database = SqliteDatabase.open(dbPath);
    const exporter = new PortableBundleExport(
      SavedConnections.open(dbPath, credentialStore),
      AccessRegistry.fromDatabase(database, credentialStore),
      AgentConnectionSettings.fromDatabase(database),
    );
    const envelope = exporter.create({
      source: {
        appVersion: "0.99.0",
        platform: "macos",
        storageMode: "encrypted_local_storage",
      },
      exportPassphrase: "bundle-passphrase",
    });
    database.close();

    const payload = new PortableBundleCodec().open(JSON.stringify(envelope), "bundle-passphrase");
    expect(payload.connections).toEqual([
      expect.objectContaining({
        stableKey: "openai|openai|openai_session|identity:account:acct_123",
        endpointId: "openai",
        endpointFamily: "openai",
        endpointUrl: "https://api.openai.com/v1",
        identityKey: "account:acct_123",
        enabledAgents: ["codex", "openclaw"],
        selectedByAgents: ["codex"],
        modelSelections: {
          openclaw: "gpt-5.3-codex",
        },
      }),
    ]);
  });

  it("imports a portable bundle with replace_existing and restores selections", async () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new MemoryCredentialStore();
    createOpenAiConnection({
      dbPath,
      credentialStore,
      id: "acct-123",
      label: "Old label",
      backend: "system_secure_storage",
      identityKey: "account:acct_123",
      credential: {
        kind: "openai_session",
        accountId: "acct_123",
        idToken: "old-id",
        accessToken: "old-access",
        refreshToken: "old-refresh",
      },
      enabledAgents: ["codex"],
    });

    const payload = {
      version: 1 as const,
      exportedAt: "2026-05-27T12:00:00.000Z",
      source: {
        appVersion: "0.99.0",
        platform: "macos" as const,
        storageMode: "encrypted_local_storage" as const,
      },
      connections: [
        {
          stableKey: PORTABLE_CONNECTION_IDENTITY.createStableKey({
            endpointFamily: "openai",
            endpointId: "openai",
            endpointUrl: "https://api.openai.com/v1",
            authMode: "openai_session",
            identityKey: "account:acct_123",
          }),
          label: "Imported label",
          endpointId: "openai",
          endpointFamily: "openai" as const,
          endpointUrl: "https://api.openai.com/v1",
          authMode: "openai_session" as const,
          identityKey: "account:acct_123",
          enabledAgents: ["codex", "openclaw"],
          configurableAgents: ["codex", "openclaw"],
          selectedByAgents: ["codex"],
          modelSelections: {
            openclaw: "gpt-5.3-codex",
          },
          credential: {
            kind: "openai_session" as const,
            accountId: "acct_123",
            idToken: "new-id",
            accessToken: "new-access",
            refreshToken: "new-refresh",
          },
        },
      ],
    } satisfies PortableBundlePayload;
    const bundle = new PortableBundleCodec().create({
      source: payload.source,
      connections: payload.connections,
      exportedAt: payload.exportedAt,
    }, "bundle-passphrase");

    const database = SqliteDatabase.open(dbPath);
    const importService = new PortableBundleImport(
      SavedConnections.open(dbPath, credentialStore),
      {
        remove: (connectionId) => {
          const connections = SavedConnections.open(dbPath, credentialStore);
          try {
            connections.remove(connectionId);
          } finally {
            connections.close();
          }
        },
      },
      AccessRegistry.fromDatabase(database, credentialStore),
      AgentSelection.fromDatabase(database),
      AgentConnectionSettings.fromDatabase(database),
      new DirectConnectionCreator(dbPath, credentialStore),
    );
    const result = await importService.apply(bundle, {
      exportPassphrase: "bundle-passphrase",
      targetStorageMode: "encrypted_local_storage",
      strategy: "replace_existing",
    });
    database.close();

    expect(result).toEqual({
      importedConnectionIds: ["acct-123"],
      replacedConnectionIds: ["acct-123"],
      skippedStableKeys: [],
    });

    const saved = SavedConnections.open(dbPath, credentialStore);
    expect(saved.list()).toEqual([
      expect.objectContaining({
        id: "acct-123",
        label: "Imported label",
        credentialStorageBackend: "encrypted_local_storage",
        enabledAgents: ["codex", "openclaw"],
        selectedByAgents: ["codex"],
      }),
    ]);
    expect(saved.readCredential("acct-123")).toEqual({
      kind: "openai_session",
      accountId: "acct_123",
      idToken: "new-id",
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });
    saved.close();

    const restoredSettings = AgentConnectionSettings.open(dbPath);
    expect(restoredSettings.get("openclaw", "acct-123")?.modelId).toBe("gpt-5.3-codex");
    restoredSettings.close();
  });
});

function createTempDatabasePath(): string {
  const root = mkdtempSync(join(tmpdir(), "nile-portable-workflow-"));
  tempRoots.push(root);
  return join(root, "switcher.sqlite");
}

function createOpenAiConnection(input: {
  dbPath: string;
  credentialStore: MemoryCredentialStore;
  id: string;
  label: string;
  backend: "system_secure_storage" | "encrypted_local_storage";
  identityKey: string;
  credential: StoredCredential;
  enabledAgents: Array<"codex" | "openclaw">;
}): void {
  const endpointRegistry = EndpointRegistry.open(input.dbPath);
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
  endpointRegistry.close();

  const accessRegistry = AccessRegistry.open(input.dbPath, input.credentialStore);
  accessRegistry.add(
    {
      id: input.id,
      endpointId: "openai",
      label: input.label,
      authMode: "openai_session",
      identityKey: input.identityKey,
      enabledAgents: input.enabledAgents,
      credentialStorageBackend: input.backend,
    },
    input.credential,
  );
  accessRegistry.close();
}

class DirectConnectionCreator {
  constructor(
    private readonly dbPath: string,
    private readonly credentialStore: MemoryCredentialStore,
  ) {}

  async create(input: CreateConnectionInput) {
    createOpenAiConnection({
      dbPath: this.dbPath,
      credentialStore: this.credentialStore,
      id: input.id ?? "generated",
      label: input.label?.trim() || "Imported connection",
      backend: input.credentialStorageBackend,
      identityKey: input.credential.kind === "openai_session" && input.credential.accountId
        ? `account:${input.credential.accountId}`
        : "identity:unknown",
      credential: input.credential,
      enabledAgents: (input.enabledAgents as Array<"codex" | "openclaw"> | undefined) ?? ["codex"],
    });

    return {
      id: input.id ?? "generated",
      label: input.label?.trim() || "Imported connection",
      endpointId: "openai",
      endpointLabel: "OpenAI",
      endpointFamily: "openai" as const,
      authMode: input.authMode,
    };
  }
}

class MemoryCredentialStore implements CredentialStore {
  private readonly credentials = new Map<string, StoredCredential>();

  create(target: CredentialStoreTarget, credential: StoredCredential): void {
    this.credentials.set(this.toKey(target), credential);
  }

  update(target: CredentialStoreTarget, credential: StoredCredential): void {
    this.credentials.set(this.toKey(target), credential);
  }

  get(target: CredentialStoreTarget): StoredCredential {
    const credential = this.credentials.get(this.toKey(target));
    if (!credential) {
      throw new Error(`Missing credential for ${this.toKey(target)}`);
    }
    return credential;
  }

  has(target: CredentialStoreTarget): boolean {
    return this.credentials.has(this.toKey(target));
  }

  remove(target: CredentialStoreTarget): void {
    this.credentials.delete(this.toKey(target));
  }

  private toKey(target: CredentialStoreTarget): string {
    const normalized = normalizeCredentialStoreTarget(target);
    return `${normalized.backend}|${normalized.reference}`;
  }
}
