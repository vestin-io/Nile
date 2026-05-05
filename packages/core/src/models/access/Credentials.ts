import {
  type CredentialStore,
  CredentialAlreadyExistsError,
  CredentialNotFoundError,
} from "../../services/credential/Store";
import type { StoredCredential } from "../../services/credential/Types";
import { AccessRegistryConsistencyError } from "./Errors";
import type { AccessCredentialSyncState, AccessRecord } from "./Types";
import { SqliteAccessStore } from "./SqliteAccessStore";

export class AccessCredentials {
  constructor(
    private readonly accessStore: SqliteAccessStore,
    private readonly credentialStore: CredentialStore,
  ) {}

  syncCreated(record: AccessRecord, credential: StoredCredential): void {
    try {
      this.createOrUpdate(record, credential);
      this.markReady(record);
    } catch (error) {
      this.markFailure(record, "write_failed", error);
      throw this.buildConsistencyError(
        `Credential sync failed after access create for ${record.id}`,
        error,
      );
    }
  }

  syncUpdated(record: AccessRecord, credential: StoredCredential): void {
    try {
      this.credentialStore.update(record.credentialSource.reference, credential);
      this.markReady(record);
    } catch (error) {
      this.markFailure(record, "write_failed", error);
      throw this.buildConsistencyError(
        `Credential sync failed after access update for ${record.id}`,
        error,
      );
    }
  }

  syncRemoved(record: AccessRecord): void {
    try {
      this.removeIfPresent(record);
    } catch (error) {
      this.markFailure(record, "delete_failed", error);
      throw this.buildConsistencyError(
        `Credential removal failed for access ${record.id}`,
        error,
      );
    }
  }

  read(record: AccessRecord): StoredCredential {
    const state = record.credentialSyncState ?? "ready";
    if (state !== "ready") {
      throw new AccessRegistryConsistencyError(
        `Credential for access ${record.id} is not synchronized (${state})`,
      );
    }

    try {
      return this.credentialStore.get(record.credentialSource.reference);
    } catch (error) {
      if (error instanceof CredentialNotFoundError) {
        this.markFailure(record, "write_failed", error);
        throw new AccessRegistryConsistencyError(
          `Credential for access ${record.id} is missing from the credential store`,
        );
      }
      throw error;
    }
  }

  markDeletePending(record: AccessRecord): void {
    this.writeState(record, "pending_delete", null);
  }

  private createOrUpdate(record: AccessRecord, credential: StoredCredential): void {
    try {
      this.credentialStore.create(record.credentialSource.reference, credential);
    } catch (error) {
      if (!(error instanceof CredentialAlreadyExistsError)) {
        throw error;
      }
      this.credentialStore.update(record.credentialSource.reference, credential);
    }
  }

  private removeIfPresent(record: AccessRecord): void {
    try {
      this.credentialStore.remove(record.credentialSource.reference);
    } catch (error) {
      if (error instanceof CredentialNotFoundError) {
        return;
      }
      throw error;
    }
  }

  private markReady(record: AccessRecord): void {
    this.writeState(record, "ready", null);
  }

  private markFailure(
    record: AccessRecord,
    state: "write_failed" | "delete_failed",
    error: unknown,
  ): void {
    this.writeState(record, state, this.describeIssue(error));
  }

  private writeState(
    record: AccessRecord,
    state: AccessCredentialSyncState,
    issue: string | null,
  ): void {
    try {
      this.accessStore.setCredentialSyncState(
        record.id,
        state,
        issue,
        new Date().toISOString(),
      );
    } catch (error) {
      throw this.buildConsistencyError(
        `Failed to persist credential sync state for access ${record.id}`,
        error,
      );
    }
  }

  private describeIssue(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private buildConsistencyError(message: string, cause: unknown): AccessRegistryConsistencyError {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return new AccessRegistryConsistencyError(`${message}: ${detail}`);
  }
}
