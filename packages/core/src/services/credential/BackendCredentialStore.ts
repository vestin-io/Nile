import { dirname, join } from "node:path";

import type { StoredCredential } from "./Types";
import { EncryptedLocalCredentialStore } from "./EncryptedLocalCredentialStore";
import { KeychainCredentialStore } from "./KeychainCredentialStore";
import {
  type CredentialStorageBackend,
  type CredentialStore,
  type CredentialStoreTarget,
  normalizeCredentialStoreTarget,
} from "./Store";

export class BackendCredentialStore implements CredentialStore {
  private readonly encryptedLocalStore: EncryptedLocalCredentialStore;

  constructor(
    databasePath: string,
    private readonly systemStore: CredentialStore = new KeychainCredentialStore(),
  ) {
    this.encryptedLocalStore = new EncryptedLocalCredentialStore(
      join(dirname(databasePath), "credentials", "encrypted-local.v1.json"),
    );
  }

  hasEncryptedLocalVault(): boolean {
    return this.encryptedLocalStore.hasVault();
  }

  isEncryptedLocalUnlocked(): boolean {
    return this.encryptedLocalStore.isUnlocked();
  }

  unlockEncryptedLocalStorage(passphrase: string): void {
    this.encryptedLocalStore.unlock(passphrase);
  }

  clearUnlockedCredentials(): void {
    this.encryptedLocalStore.clearUnlockedKey();
  }

  create(target: CredentialStoreTarget, credential: StoredCredential): void {
    this.selectStore(target).create(target, credential);
  }

  update(target: CredentialStoreTarget, credential: StoredCredential): void {
    this.selectStore(target).update(target, credential);
  }

  get(target: CredentialStoreTarget): StoredCredential {
    return this.selectStore(target).get(target);
  }

  has(target: CredentialStoreTarget): boolean {
    return this.selectStore(target).has(target);
  }

  remove(target: CredentialStoreTarget): void {
    this.selectStore(target).remove(target);
  }

  private selectStore(target: CredentialStoreTarget): CredentialStore {
    const backend = normalizeCredentialStoreTarget(target).backend;
    return backend === "encrypted_local_storage"
      ? this.encryptedLocalStore
      : this.systemStore;
  }
}

export function buildCredentialStoreTarget(
  reference: string,
  backend: CredentialStorageBackend | undefined,
): CredentialStoreTarget {
  if (!backend || backend === "system_secure_storage") {
    return reference;
  }
  return { reference, backend };
}
