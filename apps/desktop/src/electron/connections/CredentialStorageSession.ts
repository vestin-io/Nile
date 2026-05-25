import type {
  CredentialStorageBackend,
  CredentialStorageSession,
} from "@nile/core/services/credential";

type PrepareCredentialStorageOptions = {
  allowCreate: boolean;
};

export type DesktopCredentialStorageState = {
  encryptedLocalUnlocked: boolean;
  encryptedLocalVaultExists: boolean;
};

export class DesktopCredentialStorageSession {
  constructor(private readonly session: CredentialStorageSession | null) {}

  readState(): DesktopCredentialStorageState {
    return {
      encryptedLocalVaultExists: this.session?.hasEncryptedLocalVault() ?? false,
      encryptedLocalUnlocked: this.session?.isEncryptedLocalUnlocked() ?? false,
    };
  }

  unlockEncryptedLocalStorage(passphrase: string): void {
    this.requireSession().unlockEncryptedLocalStorage(passphrase);
  }

  prepareStorage(
    backend: CredentialStorageBackend | undefined,
    passphrase: string | undefined,
    options: PrepareCredentialStorageOptions,
  ): void {
    if (backend !== "encrypted_local_storage") {
      return;
    }

    const session = this.requireSession();
    if (!session.hasEncryptedLocalVault()) {
      if (!passphrase?.trim()) {
        throw new Error("Encrypted local storage passphrase is required.");
      }
      if (!options.allowCreate) {
        return;
      }
    }

    if (passphrase?.trim()) {
      session.unlockEncryptedLocalStorage(passphrase.trim());
      return;
    }

    if (!session.isEncryptedLocalUnlocked()) {
      throw new Error("Encrypted local storage is locked. Enter your passphrase and try again.");
    }
  }

  clearUnlockedCredentials(): void {
    this.session?.clearUnlockedCredentials();
  }

  private requireSession(): CredentialStorageSession {
    if (!this.session) {
      throw new Error("Encrypted local storage is not available in this desktop session.");
    }
    return this.session;
  }
}
