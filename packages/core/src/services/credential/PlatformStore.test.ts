import { describe, expect, it } from "vitest";

import { BackendCredentialStore } from "./BackendCredentialStore";
import { KeychainCredentialStore } from "./KeychainCredentialStore";
import { createPlatformCredentialStore, createPlatformWorkspaceCredentialStore } from "./PlatformStore";
import { WindowsCredentialManagerStore } from "./WindowsCredentialManagerStore";

describe("createPlatformCredentialStore", () => {
  it("returns the Windows credential manager store on win32", () => {
    expect(createPlatformCredentialStore("win32")).toBeInstanceOf(WindowsCredentialManagerStore);
  });

  it("keeps the keychain store on non-Windows platforms", () => {
    expect(createPlatformCredentialStore("darwin")).toBeInstanceOf(KeychainCredentialStore);
    expect(createPlatformCredentialStore("linux")).toBeInstanceOf(KeychainCredentialStore);
  });
});

describe("createPlatformWorkspaceCredentialStore", () => {
  it("wraps the platform store with backend-aware workspace routing", () => {
    expect(createPlatformWorkspaceCredentialStore("/tmp/nile.sqlite", "darwin")).toBeInstanceOf(BackendCredentialStore);
    expect(createPlatformWorkspaceCredentialStore("/tmp/nile.sqlite", "win32")).toBeInstanceOf(BackendCredentialStore);
  });
});
