import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "../models/access";
import { EndpointRegistry } from "../models/endpoint";
import { CursorUsageBindingRegistry } from "../actions/usage/cursor/BindingRegistry";
import { CursorUsageSnapshotStore } from "../actions/usage/cursor/SnapshotStore";
import { NileSession } from "./NileSession";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("NileSession", () => {
  it("removes saved Cursor usage artifacts when deleting a connection", () => {
    const setup = createSetup();

    const endpointRegistry = EndpointRegistry.open(setup.dbPath);
    endpointRegistry.add({
      id: "cursor",
      label: "Cursor",
      rootUrl: "https://api2.cursor.sh",
      profile: "cursor-backend",
      protocols: {
        cursor: {},
      },
    });
    endpointRegistry.close();

    const accessRegistry = AccessRegistry.open(setup.dbPath, setup.credentialStore);
    accessRegistry.add({
      id: "cursor-session",
      endpointId: "cursor",
      label: "cursor.user@example.com",
      authMode: "cursor_session",
      identityKey: "auth:auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
    }, {
      kind: "cursor_session",
      accessToken: "cursor-access-token",
      refreshToken: "cursor-refresh-token",
      authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
      email: "cursor.user@example.com",
    });
    accessRegistry.close();

    const bindingRegistry = CursorUsageBindingRegistry.open(setup.dbPath, setup.credentialStore);
    bindingRegistry.bind(
      {
        connectionId: "cursor-session",
        accountFingerprint: {
          authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
          workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
          email: "cursor.user@example.com",
        },
      },
      CURSOR_WEB_SESSION_TOKEN,
    );
    bindingRegistry.close();

    const snapshotStore = CursorUsageSnapshotStore.open(setup.dbPath);
    snapshotStore.save({
      connectionId: "cursor-session",
      accountFingerprint: {
        authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
        workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
        email: "cursor.user@example.com",
      },
      totalPercentUsed: 12,
      autoPercentUsed: 8,
      apiPercentUsed: 4,
      billingCycleStart: "2026-05-01T00:00:00.000Z",
      billingCycleEnd: "2026-06-01T00:00:00.000Z",
      fetchedAt: "2026-05-03T00:00:00.000Z",
      freshness: "live",
    });
    snapshotStore.close();

    const session = NileSession.open({
      databasePath: setup.dbPath,
      credentialStore: setup.credentialStore,
    });

    try {
      expect(session.removeConnection("cursor-session")).toEqual({
        id: "cursor-session",
        removed: true,
        orphanedAgents: [],
      });
    } finally {
      session.close();
    }

    const verificationBindings = CursorUsageBindingRegistry.open(setup.dbPath, setup.credentialStore);
    const verificationSnapshots = CursorUsageSnapshotStore.open(setup.dbPath);
    const verificationAccesses = AccessRegistry.open(setup.dbPath, setup.credentialStore);

    try {
      expect(verificationBindings.get("cursor-session")).toBeNull();
      expect(verificationSnapshots.get("cursor-session")).toBeNull();
      expect(verificationAccesses.get("cursor-session")).toBeNull();
      expect(setup.credentialStore.has("usage:cursor:cursor-session")).toBe(false);
    } finally {
      verificationBindings.close();
      verificationSnapshots.close();
      verificationAccesses.close();
    }
  });
});

function createSetup(): {
  dbPath: string;
  credentialStore: StubCredentialStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-session-remove-"));
  tempDirs.push(dir);
  return {
    dbPath: join(dir, "switcher.sqlite"),
    credentialStore: new StubCredentialStore(),
  };
}

class StubCredentialStore {
  private readonly credentials = new Map<string, unknown>();

  create(id: string, credential: unknown): void {
    this.credentials.set(id, credential);
  }

  update(id: string, credential: unknown): void {
    this.credentials.set(id, credential);
  }

  get(id: string) {
    const credential = this.credentials.get(id);
    if (!credential) {
      throw new Error(`Missing stub credential: ${id}`);
    }
    return credential as never;
  }

  has(id: string): boolean {
    return this.credentials.has(id);
  }

  remove(id: string): void {
    this.credentials.delete(id);
  }
}

const CURSOR_WEB_SESSION_TOKEN = "user_01K03K41CNGRCADY5VT0JPH69Y::eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhdXRoMHx1c2VyXzAxSzAzSzQxQ05HUkNBRFk1VlQwSlBINjlZIiwidHlwZSI6IndlYiIsImV4cCI6NDEwMjQ0NDgwMH0.sig";
