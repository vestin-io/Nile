import type { StoredCredential } from "./Types";

export type CredentialStorageBackend =
  | "system_secure_storage"
  | "encrypted_local_storage";

export const SUPPORTED_CREDENTIAL_STORAGE_BACKENDS: CredentialStorageBackend[] = [
  "system_secure_storage",
  "encrypted_local_storage",
];

export type CredentialStoreTarget = string | {
  reference: string;
  backend?: CredentialStorageBackend;
};

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

export class SystemSecureCredentialStoreDeniedError extends CredentialStoreCommandError {
  constructor(message = "System secure storage access was denied.") {
    super(message);
    this.name = "SystemSecureCredentialStoreDeniedError";
  }
}

export class EncryptedLocalCredentialStoreLockedError extends CredentialStoreCommandError {
  constructor() {
    super("Encrypted local storage is locked. Unlock it with your passphrase and try again.");
    this.name = "EncryptedLocalCredentialStoreLockedError";
  }
}

export class EncryptedLocalCredentialStorePassphraseError extends CredentialStoreCommandError {
  constructor(message = "Encrypted local storage passphrase is invalid.") {
    super(message);
    this.name = "EncryptedLocalCredentialStorePassphraseError";
  }
}

export interface CredentialStore {
  create(target: CredentialStoreTarget, credential: StoredCredential): void;
  update(target: CredentialStoreTarget, credential: StoredCredential): void;
  get(target: CredentialStoreTarget): StoredCredential;
  has(target: CredentialStoreTarget): boolean;
  remove(target: CredentialStoreTarget): void;
}

export function normalizeCredentialStoreTarget(
  target: CredentialStoreTarget,
): { reference: string; backend: CredentialStorageBackend } {
  if (typeof target === "string") {
    return {
      reference: target,
      backend: "system_secure_storage",
    };
  }
  return {
    reference: target.reference,
    backend: target.backend ?? "system_secure_storage",
  };
}
