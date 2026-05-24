import { basename, dirname, join } from "node:path";

import type { StoredCredential } from "@nile/core/services/credential";
import {
  CredentialAlreadyExistsError,
  CredentialNotFoundError,
  type CredentialStore,
  CredentialStoreValidationError,
} from "@nile/core/services/credential";

import { DesktopSecretFileStore } from "../storage/DesktopSecretFileStore";

export class DesktopCredentialStore implements CredentialStore {
  private readonly cache = new Map<string, StoredCredential>();
  private readonly store: DesktopSecretFileStore;

  constructor(databasePath: string) {
    this.store = new DesktopSecretFileStore(readCredentialStorePath(databasePath));
  }

  create(credentialId: string, credential: StoredCredential): void {
    const normalizedCredentialId = this.normalizeCredentialId(credentialId);
    if (this.store.has(normalizedCredentialId)) {
      throw new CredentialAlreadyExistsError(normalizedCredentialId);
    }

    this.store.write(normalizedCredentialId, JSON.stringify(credential));
    this.cache.set(normalizedCredentialId, credential);
  }

  update(credentialId: string, credential: StoredCredential): void {
    const normalizedCredentialId = this.normalizeCredentialId(credentialId);
    if (!this.store.has(normalizedCredentialId)) {
      throw new CredentialNotFoundError(normalizedCredentialId);
    }

    this.store.write(normalizedCredentialId, JSON.stringify(credential));
    this.cache.set(normalizedCredentialId, credential);
  }

  get(credentialId: string): StoredCredential {
    const normalizedCredentialId = this.normalizeCredentialId(credentialId);
    const cached = this.cache.get(normalizedCredentialId);
    if (cached) {
      return cached;
    }

    const raw = this.store.read(normalizedCredentialId);
    if (raw === null) {
      throw new CredentialNotFoundError(normalizedCredentialId);
    }

    const credential = JSON.parse(raw) as StoredCredential;
    this.cache.set(normalizedCredentialId, credential);
    return credential;
  }

  has(credentialId: string): boolean {
    const normalizedCredentialId = this.normalizeCredentialId(credentialId);
    if (this.cache.has(normalizedCredentialId)) {
      return true;
    }

    return this.store.has(normalizedCredentialId);
  }

  remove(credentialId: string): void {
    const normalizedCredentialId = this.normalizeCredentialId(credentialId);
    const removed = this.store.remove(normalizedCredentialId);
    this.cache.delete(normalizedCredentialId);
    if (!removed) {
      throw new CredentialNotFoundError(normalizedCredentialId);
    }
  }

  private normalizeCredentialId(credentialId: string): string {
    const normalizedCredentialId = credentialId.trim();
    if (!normalizedCredentialId) {
      throw new CredentialStoreValidationError("Credential id is required");
    }
    return normalizedCredentialId;
  }
}

function readCredentialStorePath(databasePath: string): string {
  const databaseDir = dirname(databasePath);
  const databaseBaseName = basename(databasePath, ".sqlite");
  return join(databaseDir, `${databaseBaseName}.credentials.json`);
}
