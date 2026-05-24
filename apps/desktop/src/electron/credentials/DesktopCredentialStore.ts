import { basename, dirname, join } from "node:path";

import type { CredentialStoreTarget, StoredCredential } from "@nile/core/services/credential";
import {
  CredentialAlreadyExistsError,
  CredentialNotFoundError,
  type CredentialStore,
  CredentialStoreValidationError,
  normalizeCredentialStoreTarget,
} from "@nile/core/services/credential";

import { DesktopSecretFileStore } from "../storage/DesktopSecretFileStore";

export class DesktopCredentialStore implements CredentialStore {
  private readonly cache = new Map<string, StoredCredential>();
  private readonly store: DesktopSecretFileStore;

  constructor(databasePath: string) {
    this.store = new DesktopSecretFileStore(readCredentialStorePath(databasePath));
  }

  create(target: CredentialStoreTarget, credential: StoredCredential): void {
    const normalizedCredentialId = this.normalizeCredentialId(target);
    if (this.store.has(normalizedCredentialId)) {
      throw new CredentialAlreadyExistsError(normalizedCredentialId);
    }

    this.store.write(normalizedCredentialId, JSON.stringify(credential));
    this.cache.set(normalizedCredentialId, credential);
  }

  update(target: CredentialStoreTarget, credential: StoredCredential): void {
    const normalizedCredentialId = this.normalizeCredentialId(target);
    if (!this.store.has(normalizedCredentialId)) {
      throw new CredentialNotFoundError(normalizedCredentialId);
    }

    this.store.write(normalizedCredentialId, JSON.stringify(credential));
    this.cache.set(normalizedCredentialId, credential);
  }

  get(target: CredentialStoreTarget): StoredCredential {
    const normalizedCredentialId = this.normalizeCredentialId(target);
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

  has(target: CredentialStoreTarget): boolean {
    const normalizedCredentialId = this.normalizeCredentialId(target);
    if (this.cache.has(normalizedCredentialId)) {
      return true;
    }

    return this.store.has(normalizedCredentialId);
  }

  remove(target: CredentialStoreTarget): void {
    const normalizedCredentialId = this.normalizeCredentialId(target);
    const removed = this.store.remove(normalizedCredentialId);
    this.cache.delete(normalizedCredentialId);
    if (!removed) {
      throw new CredentialNotFoundError(normalizedCredentialId);
    }
  }

  private normalizeCredentialId(target: CredentialStoreTarget): string {
    const normalizedCredentialId = normalizeCredentialStoreTarget(target).reference.trim();
    if (!normalizedCredentialId) {
      throw new CredentialStoreValidationError("Credential id is required");
    }
    return normalizedCredentialId;
  }
}

export function readCredentialStorePath(databasePath: string): string {
  const databaseDir = dirname(databasePath);
  const databaseBaseName = basename(databasePath, ".sqlite");
  return join(databaseDir, `${databaseBaseName}.credentials.json`);
}
