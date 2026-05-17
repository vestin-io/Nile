import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "@nile/core/models/access";
import { EndpointRegistry } from "@nile/core/models/endpoint";
import { CursorUsageBinder } from "./Binder";
import { CursorUsageBindingRegistry, CursorUsageBindingValidationError } from "./BindingRegistry";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("CursorUsageBinder", () => {
  it("binds a matching Cursor usage session to a saved connection", () => {
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

    const binder = new CursorUsageBinder(
      endpointRegistry,
      accessRegistry,
      CursorUsageBindingRegistry.open(setup.dbPath, setup.credentialStore),
    );

    const result = binder.bind("cursor-session", CURSOR_WEB_SESSION_TOKEN);

    expect(result).toEqual({
      connectionId: "cursor-session",
      connectionLabel: "cursor.user@example.com",
      endpointLabel: "Cursor",
      endpointFamily: "cursor",
      workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
      boundAt: expect.any(String),
    });

    expect(setup.credentialStore.get("usage:cursor:cursor-session")).toEqual({
      kind: "cursor_web_session",
      sessionToken: CURSOR_WEB_SESSION_TOKEN,
    });

    accessRegistry.close();
    endpointRegistry.close();
  });

  it("rejects a mismatched web session token", () => {
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

    const binder = new CursorUsageBinder(
      endpointRegistry,
      accessRegistry,
      CursorUsageBindingRegistry.open(setup.dbPath, setup.credentialStore),
    );

    expect(() => binder.bind("cursor-session", MISMATCHED_CURSOR_WEB_SESSION_TOKEN)).toThrow(
      CursorUsageBindingValidationError,
    );

    expect(setup.credentialStore.has("usage:cursor:cursor-session")).toBe(false);

    accessRegistry.close();
    endpointRegistry.close();
  });

  it("accepts a matching Cursor local access token wrapped as a usage session", () => {
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

    const binder = new CursorUsageBinder(
      endpointRegistry,
      accessRegistry,
      CursorUsageBindingRegistry.open(setup.dbPath, setup.credentialStore),
    );

    const result = binder.bind("cursor-session", CURSOR_LOCAL_USAGE_SESSION_TOKEN);

    expect(result.workosUserId).toBe("user_01K03K41CNGRCADY5VT0JPH69Y");

    accessRegistry.close();
    endpointRegistry.close();
  });
});

function createSetup(): {
  dbPath: string;
  credentialStore: StubCredentialStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-cursor-usage-binder-"));
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
const CURSOR_LOCAL_USAGE_SESSION_TOKEN = "user_01K03K41CNGRCADY5VT0JPH69Y::eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhdXRoMHx1c2VyXzAxSzAzSzQxQ05HUkNBRFk1VlQwSlBINjlZIiwidHlwZSI6ImFjY2VzcyIsImV4cCI6NDEwMjQ0NDgwMH0.sig";
const MISMATCHED_CURSOR_WEB_SESSION_TOKEN = "user_01DIFFERENTUSER0000000000000::eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhdXRoMHx1c2VyXzAxRElGRkVSRU5UVVNFUjAwMDAwMDAwMDAwMDAiLCJ0eXBlIjoid2ViIiwiZXhwIjoyMDAwMDAwMDAwfQ.signature";
