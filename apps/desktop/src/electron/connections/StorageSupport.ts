import {
  type CredentialStorageBackend,
  SystemSecureCredentialStoreDeniedError,
} from "@nile/core/services/credential";

import { DesktopCredentialStorageSession } from "./CredentialStorageSession";

type PrepareCredentialStorageOptions = {
  allowCreate: boolean;
};

export class DesktopConnectionStorageSupport {
  constructor(private readonly session: DesktopCredentialStorageSession | null) {}

  prepare(
    backend: CredentialStorageBackend | undefined,
    passphrase: string | undefined,
    options: PrepareCredentialStorageOptions,
  ): void {
    this.readSession().prepareStorage(backend, passphrase, options);
  }

  unlockEncryptedLocalStorage(passphrase: string): void {
    this.readSession().unlockEncryptedLocalStorage(passphrase);
  }

  mapError(
    error: unknown,
    backend: CredentialStorageBackend | undefined,
  ): Error {
    if (
      backend === "system_secure_storage"
      && (
        error instanceof SystemSecureCredentialStoreDeniedError
        || (error instanceof Error && error.message.includes("System secure storage access was denied."))
      )
    ) {
      return new Error(
        "System secure storage was denied by the operating system. Choose Encrypted local storage to continue without system secure storage.",
      );
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  private readSession(): DesktopCredentialStorageSession {
    return this.session ?? new DesktopCredentialStorageSession(null);
  }
}
