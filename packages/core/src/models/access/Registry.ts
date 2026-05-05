import {
  type CredentialStore,
} from "../../services/credential/Store";
import {
  LocalCredentialSourceFactory,
  type CredentialSourceFactory,
} from "../../services/credential/Factory";
import type { StoredCredential } from "../../services/credential/Types";
import { SqliteDatabase } from "../../services/database/SqliteDatabase";
import { EndpointRegistry } from "../endpoint";
import { AccessCredentials } from "./Credentials";
import { AccessRecordBuilder } from "./Builder";
import {
  AccessNotFoundError,
  AccessRegistryValidationError,
  DuplicateAccessIdError,
} from "./Errors";
import { SqliteAccessStore } from "./SqliteAccessStore";
import type { AccessRecord, AccessRegistryInput, AccessRegistryUpdate } from "./Types";
export { AccessRegistryConsistencyError } from "./Errors";
export { AccessRegistryValidationError } from "./Errors";
export { DuplicateAccessIdError } from "./Errors";
export { AccessNotFoundError } from "./Errors";

export class AccessRegistry {
  private readonly recordBuilder: AccessRecordBuilder;
  private readonly credentials: AccessCredentials;

  static open(
    databasePath: string,
    credentialStore: CredentialStore,
    credentialSourceFactory: CredentialSourceFactory = new LocalCredentialSourceFactory(),
  ): AccessRegistry {
    const database = SqliteDatabase.open(databasePath);
    return new AccessRegistry(
      new SqliteAccessStore(database),
      credentialStore,
      EndpointRegistry.fromDatabase(database),
      credentialSourceFactory,
      database,
    );
  }

  static fromDatabase(
    database: SqliteDatabase,
    credentialStore: CredentialStore,
    credentialSourceFactory: CredentialSourceFactory = new LocalCredentialSourceFactory(),
  ): AccessRegistry {
    return new AccessRegistry(
      new SqliteAccessStore(database),
      credentialStore,
      EndpointRegistry.fromDatabase(database),
      credentialSourceFactory,
      null,
    );
  }

  constructor(
    private readonly accessStore: SqliteAccessStore,
    credentialStore: CredentialStore,
    endpointRegistry: EndpointRegistry,
    credentialSourceFactory: CredentialSourceFactory,
    private readonly ownedDatabase: SqliteDatabase | null = null,
  ) {
    this.recordBuilder = new AccessRecordBuilder(endpointRegistry, credentialSourceFactory);
    this.credentials = new AccessCredentials(accessStore, credentialStore);
  }

  add(input: AccessRegistryInput, credential: StoredCredential): AccessRecord {
    const record = this.recordBuilder.buildForCreate(
      input,
      credential,
      new Date().toISOString(),
    );
    const pendingRecord = {
      ...record,
      credentialSyncIssue: undefined,
      credentialSyncState: "pending_write" as const,
    };

    try {
      this.accessStore.insert(pendingRecord);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new DuplicateAccessIdError(record.id);
      }
      throw error;
    }

    this.credentials.syncCreated(pendingRecord, credential);

    return this.getOrThrow(record.id);
  }

  update(accessId: string, input: AccessRegistryUpdate, credential?: StoredCredential): AccessRecord {
    const current = this.getOrThrow(accessId);
    const nextRecord = this.recordBuilder.buildForUpdate(current, input, credential);
    const updatedRecord = {
      ...nextRecord,
      credentialSource: current.credentialSource,
      credentialSyncIssue: credential === undefined ? current.credentialSyncIssue : undefined,
      credentialSyncState: credential === undefined
        ? (current.credentialSyncState ?? "ready")
        : "pending_write",
      updatedAt: new Date().toISOString(),
    };

    if (credential !== undefined) {
      this.accessStore.update(updatedRecord);
      this.credentials.syncUpdated(updatedRecord, credential);
    } else {
      this.accessStore.update(updatedRecord);
    }

    return this.getOrThrow(accessId);
  }

  get(accessId: string): AccessRecord | null {
    return this.accessStore.get(accessId);
  }

  readCredential(accessId: string): StoredCredential {
    const record = this.getOrThrow(accessId);
    return this.credentials.read(record);
  }

  list(): AccessRecord[] {
    return this.accessStore.list();
  }

  remove(accessId: string): void {
    const current = this.getOrThrow(accessId);
    this.credentials.markDeletePending(current);
    this.credentials.syncRemoved(current);

    try {
      this.accessStore.remove(accessId);
    } catch (error) {
      this.accessStore.setCredentialSyncState(
        accessId,
        "delete_failed",
        error instanceof Error ? error.message : String(error),
        new Date().toISOString(),
      );
      throw error;
    }
  }

  close(): void {
    this.ownedDatabase?.close();
  }

  private getOrThrow(accessId: string): AccessRecord {
    const record = this.accessStore.get(accessId);
    if (!record) {
      throw new AccessNotFoundError(accessId);
    }
    return record;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Error && /unique|constraint/i.test(error.message);
  }
}
