import type { StoredCredential } from "./Types";

export class CredentialStoreValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialStoreValidationError";
  }
}

export class CredentialAlreadyExistsError extends Error {
  constructor(credentialId: string) {
    super(`Credential already exists: ${credentialId}`);
    this.name = "CredentialAlreadyExistsError";
  }
}

export class CredentialNotFoundError extends Error {
  constructor(credentialId: string) {
    super(`Credential not found: ${credentialId}`);
    this.name = "CredentialNotFoundError";
  }
}

export class CredentialStoreCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialStoreCommandError";
  }
}

export interface CredentialStore {
  create(credentialId: string, credential: StoredCredential): void;
  update(credentialId: string, credential: StoredCredential): void;
  get(credentialId: string): StoredCredential;
  has(credentialId: string): boolean;
  remove(credentialId: string): void;
}
