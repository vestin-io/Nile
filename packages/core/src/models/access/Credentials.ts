import {
  type CredentialStore,
  CredentialAlreadyExistsError,
  CredentialNotFoundError,
} from "../../services/credential/Store";
import type { CredentialSource } from "../../services/credential/Source";
import type { StoredCredential } from "../../services/credential/Types";
import { AccessRegistryConsistencyError, DuplicateAccessIdError } from "./Errors";
import type { AccessRecord } from "./Types";
import type { AccessStore } from "./store/Store";

export class AccessCredentials {
  constructor(
    private readonly accessStore: AccessStore,
    private readonly credentialStore: CredentialStore,
  ) {}

  create(record: AccessRecord, credential: StoredCredential): void {
    try {
      this.credentialStore.create(record.credentialSource.reference, credential);
      return;
    } catch (error) {
      if (!(error instanceof CredentialAlreadyExistsError)) {
        throw error;
      }
    }

    if (this.accessStore.get(record.id)) {
      throw new DuplicateAccessIdError(record.id);
    }

    this.credentialStore.update(record.credentialSource.reference, credential);
  }

  update(
    current: AccessRecord,
    credential: StoredCredential,
    writeRecord: () => void,
  ): void {
    const previousCredential = this.credentialStore.get(current.credentialSource.reference);
    this.credentialStore.update(current.credentialSource.reference, credential);

    try {
      writeRecord();
    } catch (error) {
      this.rollbackUpdate(current.credentialSource, previousCredential, error);
    }
  }

  remove(
    record: AccessRecord,
    removeRecord: () => void,
  ): void {
    const previousCredential = this.credentialStore.get(record.credentialSource.reference);
    this.credentialStore.remove(record.credentialSource.reference);

    try {
      removeRecord();
    } catch (error) {
      this.restoreAfterRemove(record.credentialSource, previousCredential, error);
    }
  }

  rollbackCreate(credentialSource: CredentialSource): void {
    try {
      this.credentialStore.remove(credentialSource.reference);
    } catch (error) {
      if (error instanceof CredentialNotFoundError) {
        return;
      }
      throw error;
    }
  }

  private rollbackUpdate(
    credentialSource: CredentialSource,
    previousCredential: StoredCredential,
    cause: unknown,
  ): never {
    try {
      this.credentialStore.update(credentialSource.reference, previousCredential);
    } catch (rollbackError) {
      const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      throw new AccessRegistryConsistencyError(
        `Failed to restore credential after access update error: ${rollbackMessage}`,
      );
    }
    throw cause;
  }

  private restoreAfterRemove(
    credentialSource: CredentialSource,
    previousCredential: StoredCredential,
    cause: unknown,
  ): never {
    try {
      this.credentialStore.create(credentialSource.reference, previousCredential);
    } catch (rollbackError) {
      const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      throw new AccessRegistryConsistencyError(
        `Failed to restore credential after access removal error: ${rollbackMessage}`,
      );
    }
    throw cause;
  }
}
