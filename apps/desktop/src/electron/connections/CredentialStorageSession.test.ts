import { describe, expect, it } from "vitest";

import { DesktopCredentialStorageSession } from "./CredentialStorageSession";

describe("DesktopCredentialStorageSession", () => {
  it("reports locked encrypted-local state", () => {
    const session = new DesktopCredentialStorageSession(
      new StubCredentialStorageSession({ hasVault: true, unlocked: false }),
    );

    expect(session.readState()).toEqual({
      encryptedLocalVaultExists: true,
      encryptedLocalUnlocked: false,
    });
  });

  it("requires a passphrase before creating a new encrypted-local vault", () => {
    const stub = new StubCredentialStorageSession({ hasVault: false, unlocked: false });
    const session = new DesktopCredentialStorageSession(stub);

    expect(() => session.prepareStorage("encrypted_local_storage", undefined, { allowCreate: true })).toThrow(
      "Encrypted local storage passphrase is required.",
    );
    expect(stub.unlockPassphrases).toEqual([]);
  });

  it("does not create a vault while only preparing a draft", () => {
    const stub = new StubCredentialStorageSession({ hasVault: false, unlocked: false });
    const session = new DesktopCredentialStorageSession(stub);

    session.prepareStorage("encrypted_local_storage", "passphrase-123", { allowCreate: false });

    expect(stub.unlockPassphrases).toEqual([]);
  });

  it("unlocks an existing vault when a passphrase is supplied", () => {
    const stub = new StubCredentialStorageSession({ hasVault: true, unlocked: false });
    const session = new DesktopCredentialStorageSession(stub);

    session.prepareStorage("encrypted_local_storage", "passphrase-123", { allowCreate: true });

    expect(stub.unlockPassphrases).toEqual(["passphrase-123"]);
  });
});

class StubCredentialStorageSession {
  readonly unlockPassphrases: string[] = [];

  constructor(
    private readonly state: {
      hasVault: boolean;
      unlocked: boolean;
    },
  ) {}

  hasEncryptedLocalVault(): boolean {
    return this.state.hasVault;
  }

  isEncryptedLocalUnlocked(): boolean {
    return this.state.unlocked;
  }

  unlockEncryptedLocalStorage(passphrase: string): void {
    this.unlockPassphrases.push(passphrase);
    this.state.unlocked = true;
    this.state.hasVault = true;
  }

  clearUnlockedCredentials(): void {
    this.state.unlocked = false;
  }
}
