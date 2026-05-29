import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { type CredentialStoreTarget, normalizeCredentialStoreTarget } from "@nile/core/services/credential";
import { SqliteDatabase } from "@nile/core/services/database/SqliteDatabase";
import { CursorUsageBindingRegistry } from "./BindingRegistry";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("CursorUsageBindingRegistry", () => {
  it("persists the credential storage backend for Cursor quota bindings", () => {
    const setup = createSetup();
    const registry = CursorUsageBindingRegistry.open(setup.dbPath, setup.credentialStore);

    registry.bind({
      connectionId: "cursor-session",
      accountFingerprint: {
        authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
        workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
      },
      credentialStorageBackend: "encrypted_local_storage",
    }, CURSOR_WEB_SESSION_TOKEN);
    registry.close();

    const reopened = CursorUsageBindingRegistry.open(setup.dbPath, setup.credentialStore);
    try {
      expect(reopened.get("cursor-session")).toMatchObject({
        connectionId: "cursor-session",
        credentialStorageBackend: "encrypted_local_storage",
      });
      expect(reopened.readCredential("cursor-session")).toEqual({
        kind: "cursor_web_session",
        sessionToken: CURSOR_WEB_SESSION_TOKEN,
      });
    } finally {
      reopened.close();
    }
  });

  it("migrates an existing binding to the current credential storage backend", () => {
    const setup = createSetup();
    const registry = CursorUsageBindingRegistry.open(setup.dbPath, setup.credentialStore);

    registry.bind({
      connectionId: "cursor-session",
      accountFingerprint: {
        authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
        workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
      },
    }, CURSOR_WEB_SESSION_TOKEN);

    registry.bind({
      connectionId: "cursor-session",
      accountFingerprint: {
        authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
        workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
      },
      credentialStorageBackend: "encrypted_local_storage",
    }, CURSOR_WEB_SESSION_TOKEN);

    expect(setup.credentialStore.has("usage:cursor:cursor-session")).toBe(false);
    expect(setup.credentialStore.get({
      reference: "usage:cursor:cursor-session",
      backend: "encrypted_local_storage",
    })).toEqual({
      kind: "cursor_web_session",
      sessionToken: CURSOR_WEB_SESSION_TOKEN,
    });
    expect(registry.get("cursor-session")).toMatchObject({
      connectionId: "cursor-session",
      credentialStorageBackend: "encrypted_local_storage",
    });

    registry.close();
  });

  it("fails closed when a persisted binding row uses an unsupported backend", () => {
    const setup = createSetup();
    const registry = CursorUsageBindingRegistry.open(setup.dbPath, setup.credentialStore);

    registry.bind({
      connectionId: "cursor-session",
      accountFingerprint: {
        authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
        workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
      },
      credentialStorageBackend: "encrypted_local_storage",
    }, CURSOR_WEB_SESSION_TOKEN);
    registry.close();

    const database = SqliteDatabase.open(setup.dbPath);
    try {
      database.run(
        "UPDATE cursor_usage_bindings SET credential_storage_backend = ? WHERE connection_id = ?",
        "future_backend",
        "cursor-session",
      );
    } finally {
      database.close();
    }

    const reopened = CursorUsageBindingRegistry.open(setup.dbPath, setup.credentialStore);
    try {
      expect(() => reopened.get("cursor-session")).toThrow(
        "Unsupported credential storage backend in cursor_usage_bindings: future_backend",
      );
    } finally {
      reopened.close();
    }
  });
});

function createSetup(): {
  dbPath: string;
  credentialStore: StubCredentialStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-cursor-binding-registry-"));
  tempDirs.push(dir);
  return {
    dbPath: join(dir, "switcher.sqlite"),
    credentialStore: new StubCredentialStore(),
  };
}

class StubCredentialStore {
  private readonly credentials = new Map<string, unknown>();

  create(target: CredentialStoreTarget, credential: unknown): void {
    this.credentials.set(this.toKey(target), credential);
  }

  update(target: CredentialStoreTarget, credential: unknown): void {
    this.credentials.set(this.toKey(target), credential);
  }

  get(target: CredentialStoreTarget) {
    const key = this.toKey(target);
    const credential = this.credentials.get(key);
    if (!credential) {
      throw new Error(`Missing stub credential: ${key}`);
    }
    return credential as never;
  }

  has(target: CredentialStoreTarget): boolean {
    return this.credentials.has(this.toKey(target));
  }

  remove(target: CredentialStoreTarget): void {
    this.credentials.delete(this.toKey(target));
  }

  private toKey(target: CredentialStoreTarget): string {
    const normalized = normalizeCredentialStoreTarget(target);
    return `${normalized.backend}:${normalized.reference}`;
  }
}

const CURSOR_WEB_SESSION_TOKEN = "user_01K03K41CNGRCADY5VT0JPH69Y::eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhdXRoMHx1c2VyXzAxSzAzSzQxQ05HUkNBRFk1VlQwSlBINjlZIiwidHlwZSI6IndlYiIsImV4cCI6NDEwMjQ0NDgwMH0.sig";
