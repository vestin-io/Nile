import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "@nile/core/models/access";
import { EndpointRegistry } from "@nile/core/models/endpoint";
import { KeychainCredentialStore, type StoredCredential } from "@nile/core/services/credential";

import { CursorUsageBindingRegistry } from "./BindingRegistry";
import type { CursorUsageSessionCandidate, CursorUsageSessionProbe } from "./SessionProbe";
import { CursorUsageAutoBinder } from "./AutoBinder";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("CursorUsageAutoBinder", () => {
  it("auto-binds a matching Cursor usage session to a saved connection", () => {
    const setup = createSetup();
    const endpointRegistry = EndpointRegistry.open(setup.dbPath);
    const accessRegistry = AccessRegistry.open(setup.dbPath, setup.credentialStore);
    const bindingRegistry = CursorUsageBindingRegistry.open(setup.dbPath, setup.credentialStore);
    try {
      endpointRegistry.add({
        id: "cursor",
        label: "Cursor",
        rootUrl: "https://api2.cursor.sh",
        profile: "cursor-backend",
        protocols: {
          cursor: {},
        },
      });
      accessRegistry.add({
        id: "cursor-work",
        endpointId: "cursor",
        label: "Cursor Work",
        authMode: "cursor_session",
        identityKey: "auth:auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
        enabledAgents: ["cursor"],
      }, {
        kind: "cursor_session",
        accessToken: "cursor-access-token",
        refreshToken: "cursor-refresh-token",
        authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
        email: "cursor.user@example.com",
      });

      const binder = new CursorUsageAutoBinder(
        endpointRegistry,
        accessRegistry,
        bindingRegistry,
        new StubProbe([{
          sourceId: "cursor-local-state",
          sourceLabel: "Cursor",
          locationLabel: "Local session",
          workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
          sessionToken: CURSOR_USAGE_SESSION_TOKEN,
        }]),
      );

      const result = binder.autoBind("cursor-work");

      expect(result).toEqual({
        connectionId: "cursor-work",
        status: "bound",
        binding: {
          connectionId: "cursor-work",
          connectionLabel: "Cursor Work",
          endpointLabel: "Cursor",
          endpointFamily: "cursor",
          workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
          boundAt: expect.any(String),
        },
        sourceLabel: "Cursor",
        locationLabel: "Local session",
      });
    } finally {
      bindingRegistry.close();
      accessRegistry.close();
      endpointRegistry.close();
    }
  });
});

function createSetup(): {
  dbPath: string;
  credentialStore: StubCredentialStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-cursor-auto-bind-"));
  tempDirs.push(dir);
  return {
    dbPath: join(dir, "switcher.sqlite"),
    credentialStore: new StubCredentialStore(),
  };
}

class StubProbe implements CursorUsageSessionProbe {
  constructor(private readonly candidates: CursorUsageSessionCandidate[]) {}

  probe(): CursorUsageSessionCandidate[] {
    return this.candidates;
  }
}

class StubCredentialStore extends KeychainCredentialStore {
  private readonly credentials = new Map<string, StoredCredential>();

  override create(credentialId: string, credential: StoredCredential): void {
    this.credentials.set(credentialId, credential);
  }

  override update(credentialId: string, credential: StoredCredential): void {
    this.credentials.set(credentialId, credential);
  }

  override get(credentialId: string): StoredCredential {
    const credential = this.credentials.get(credentialId);
    if (!credential) {
      throw new Error(`Missing stub credential: ${credentialId}`);
    }
    return credential;
  }

  override has(credentialId: string): boolean {
    return this.credentials.has(credentialId);
  }

  override remove(credentialId: string): void {
    this.credentials.delete(credentialId);
  }
}

const CURSOR_USAGE_SESSION_TOKEN = "user_01K03K41CNGRCADY5VT0JPH69Y::eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhdXRoMHx1c2VyXzAxSzAzSzQxQ05HUkNBRFk1VlQwSlBINjlZIiwidHlwZSI6IndlYiIsImV4cCI6NDEwMjQ0NDgwMH0.sig";
