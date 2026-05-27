import { CredentialStoreCommandError } from "./Store";

export class PortableBundleValidationError extends CredentialStoreCommandError {
  constructor(message: string) {
    super(message);
    this.name = "PortableBundleValidationError";
  }
}

export class PortableBundlePassphraseError extends CredentialStoreCommandError {
  constructor(message = "Portable bundle could not be unlocked. The passphrase may be wrong or the bundle may be corrupted.") {
    super(message);
    this.name = "PortableBundlePassphraseError";
  }
}

export class PortableBundleVersionError extends CredentialStoreCommandError {
  constructor(message = "Portable bundle version is unsupported.") {
    super(message);
    this.name = "PortableBundleVersionError";
  }
}
