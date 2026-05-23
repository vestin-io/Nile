import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import {
  EncryptedLocalCredentialStore,
  EncryptedLocalCredentialStoreLockedError,
  EncryptedLocalCredentialStorePassphraseError,
} from "./index";
import type { StoredCredential } from "./Types";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("EncryptedLocalCredentialStore", () => {
  it("writes and reads credentials after unlocking with the correct passphrase", () => {
    const store = createStore();
    const credential: StoredCredential = { kind: "api_key", apiKey: "secret-value" };

    store.unlock("passphrase-123");
    store.create({ reference: "access:gateway-team" }, credential);
    store.clearUnlockedKey();

    expect(() => store.get({ reference: "access:gateway-team" })).toThrow(EncryptedLocalCredentialStoreLockedError);
    store.unlock("passphrase-123");
    expect(store.get({ reference: "access:gateway-team" })).toEqual(credential);
  });

  it("rejects the wrong passphrase", () => {
    const store = createStore();
    store.unlock("correct-passphrase");
    store.create({ reference: "access:gateway-team" }, { kind: "api_key", apiKey: "secret-value" });
    store.clearUnlockedKey();

    expect(() => store.unlock("wrong-passphrase")).toThrow(EncryptedLocalCredentialStorePassphraseError);
  });

  it("fails closed when ciphertext is tampered", () => {
    const { store, vaultPath } = createStoreWithPath();
    store.unlock("passphrase-123");
    store.create({ reference: "access:gateway-team" }, { kind: "api_key", apiKey: "secret-value" });

    const vault = JSON.parse(readFileSync(vaultPath, "utf8")) as {
      entries: Record<string, { ciphertextBase64: string }>;
    };
    vault.entries["access:gateway-team"].ciphertextBase64 = Buffer.from("tampered").toString("base64");
    writeFileSync(vaultPath, JSON.stringify(vault), "utf8");

    expect(() => store.get({ reference: "access:gateway-team" })).toThrow(EncryptedLocalCredentialStorePassphraseError);
  });
});

function createStore(): EncryptedLocalCredentialStore {
  return createStoreWithPath().store;
}

function createStoreWithPath(): { store: EncryptedLocalCredentialStore; vaultPath: string } {
  const dir = mkdtempSync(join(tmpdir(), "nile-encrypted-credential-store-"));
  tempDirs.push(dir);
  const vaultPath = join(dir, "credentials", "encrypted-local.v1.json");
  return {
    store: new EncryptedLocalCredentialStore(vaultPath),
    vaultPath,
  };
}
