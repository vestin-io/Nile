import {
  buildCredentialStoreTarget,
  type CredentialStore,
  CredentialAlreadyExistsError,
  type CredentialStorageBackend,
  CredentialNotFoundError,
} from "@nile/core/services/credential";
import {
  LocalCredentialSourceFactory,
  type CredentialSourceFactory,
} from "@nile/core/services/credential/Factory";
import type { CredentialSource } from "@nile/core/services/credential/Source";
import type { CursorWebSessionCredential } from "@nile/core/services/credential/Types";
import { SqliteDatabase } from "@nile/core/services/database/SqliteDatabase";
import { SqliteBindingStore } from "./BindingStore";
import type { CursorUsageBindingInput, CursorUsageBindingRecord } from "./Types";

export class CursorUsageBindingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CursorUsageBindingValidationError";
  }
}

export class CursorUsageBindingRegistry {
  static open(
    databasePath: string,
    credentialStore: CredentialStore,
    credentialSourceFactory: CredentialSourceFactory = new LocalCredentialSourceFactory(),
  ): CursorUsageBindingRegistry {
    const database = SqliteDatabase.open(databasePath);
    return new CursorUsageBindingRegistry(
      new SqliteBindingStore(database),
      credentialStore,
      credentialSourceFactory,
      database,
    );
  }

  static fromDatabase(
    database: SqliteDatabase,
    credentialStore: CredentialStore,
    credentialSourceFactory: CredentialSourceFactory = new LocalCredentialSourceFactory(),
  ): CursorUsageBindingRegistry {
    return new CursorUsageBindingRegistry(
      new SqliteBindingStore(database),
      credentialStore,
      credentialSourceFactory,
      null,
    );
  }

  constructor(
    private readonly bindingStore: SqliteBindingStore,
    private readonly credentialStore: CredentialStore,
    private readonly credentialSourceFactory: CredentialSourceFactory,
    private readonly ownedDatabase: SqliteDatabase | null = null,
  ) {}

  bind(input: CursorUsageBindingInput, sessionToken: string): CursorUsageBindingRecord {
    const createdAt = new Date().toISOString();
    const record = this.normalizeInput(input, createdAt);
    const credential = this.normalizeCredential(sessionToken);
    const existing = this.bindingStore.get(record.connectionId);

    if (existing) {
      return this.rebindExisting(existing, record, credential, createdAt);
    }

    this.createCredential(record.credentialSource, record.credentialStorageBackend, credential);
    try {
      this.bindingStore.insert(record);
    } catch (error) {
      this.removeCredentialIfPresent(record.credentialSource, record.credentialStorageBackend);
      throw error;
    }
    return this.getOrThrow(record.connectionId);
  }

  get(connectionId: string): CursorUsageBindingRecord | null {
    return this.bindingStore.get(connectionId);
  }

  readCredential(connectionId: string): CursorWebSessionCredential {
    const binding = this.getOrThrow(connectionId);
    const credential = this.credentialStore.get(
      this.buildTarget(binding.credentialSource.reference, binding.credentialStorageBackend),
    );
    if (credential.kind !== "cursor_web_session") {
      throw new CursorUsageBindingValidationError(`Expected cursor_web_session credential for ${connectionId}`);
    }
    return credential;
  }

  clear(connectionId: string): void {
    const existing = this.bindingStore.get(connectionId);
    if (!existing) {
      return;
    }

    const previousCredential = this.readStoredCursorCredential(
      existing.credentialSource.reference,
      existing.credentialStorageBackend,
    );
    this.credentialStore.remove(this.buildTarget(existing.credentialSource.reference, existing.credentialStorageBackend));
    try {
      this.bindingStore.remove(connectionId);
    } catch (error) {
      this.recreateCredential(existing.credentialSource, existing.credentialStorageBackend, previousCredential);
      throw error;
    }
  }

  close(): void {
    this.ownedDatabase?.close();
  }

  private getOrThrow(connectionId: string): CursorUsageBindingRecord {
    const record = this.bindingStore.get(connectionId);
    if (!record) {
      throw new CursorUsageBindingValidationError(`Cursor quota binding not found: ${connectionId}`);
    }
    return record;
  }

  private normalizeInput(input: CursorUsageBindingInput, timestamp: string): CursorUsageBindingRecord {
    const connectionId = input.connectionId.trim();
    if (!connectionId) {
      throw new CursorUsageBindingValidationError("Cursor quota binding connection id is required");
    }

    const authId = input.accountFingerprint.authId.trim();
    const workosUserId = input.accountFingerprint.workosUserId.trim();
    const email = input.accountFingerprint.email?.trim();
    if (!authId) {
      throw new CursorUsageBindingValidationError("Cursor quota binding authId is required");
    }
    if (!workosUserId) {
      throw new CursorUsageBindingValidationError("Cursor quota binding workosUserId is required");
    }

    return {
      connectionId,
      accountFingerprint: {
        authId,
        workosUserId,
        ...(email ? { email } : {}),
      },
      credentialSource: this.credentialSourceFactory.createCursorUsageSource({ connectionId }),
      ...(input.credentialStorageBackend ? { credentialStorageBackend: input.credentialStorageBackend } : {}),
      observedAt: timestamp,
      lastVerifiedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private normalizeCredential(sessionToken: string): CursorWebSessionCredential {
    const normalized = sessionToken.trim();
    if (!normalized) {
      throw new CursorUsageBindingValidationError("Cursor web session token is required");
    }
    return {
      kind: "cursor_web_session",
      sessionToken: normalized,
    };
  }

  private rebindExisting(
    existing: CursorUsageBindingRecord,
    record: CursorUsageBindingRecord,
    credential: CursorWebSessionCredential,
    timestamp: string,
  ): CursorUsageBindingRecord {
    const previousCredential = this.readStoredCursorCredential(
      existing.credentialSource.reference,
      existing.credentialStorageBackend,
    );
    const nextBackend = record.credentialStorageBackend;
    if (!this.hasStorageBackendChange(existing.credentialStorageBackend, nextBackend)) {
      this.credentialStore.update(
        this.buildTarget(existing.credentialSource.reference, existing.credentialStorageBackend),
        credential,
      );
      try {
        this.bindingStore.update({
          ...record,
          credentialSource: existing.credentialSource,
          ...(nextBackend ? { credentialStorageBackend: nextBackend } : {}),
          createdAt: existing.createdAt,
          updatedAt: timestamp,
        });
      } catch (error) {
        this.restoreCredential(existing.credentialSource, existing.credentialStorageBackend, previousCredential);
        throw error;
      }
      return this.getOrThrow(record.connectionId);
    }

    const previousMigratedCredential = this.readStoredCursorCredentialIfPresent(
      existing.credentialSource.reference,
      nextBackend,
    );
    this.createCredential(existing.credentialSource, nextBackend, credential);
    try {
      this.removeCredentialIfPresent(existing.credentialSource, existing.credentialStorageBackend);
    } catch (error) {
      this.restoreMigratedCredential(existing.credentialSource, nextBackend, previousMigratedCredential);
      throw error;
    }
    try {
      this.bindingStore.update({
        ...record,
        credentialSource: existing.credentialSource,
        ...(nextBackend ? { credentialStorageBackend: nextBackend } : {}),
        createdAt: existing.createdAt,
        updatedAt: timestamp,
      });
    } catch (error) {
      this.recreateCredential(existing.credentialSource, existing.credentialStorageBackend, previousCredential);
      this.restoreMigratedCredential(existing.credentialSource, nextBackend, previousMigratedCredential);
      throw error;
    }
    return this.getOrThrow(record.connectionId);
  }

  private createCredential(
    credentialSource: CredentialSource,
    credentialStorageBackend: CredentialStorageBackend | undefined,
    credential: CursorWebSessionCredential,
  ): void {
    try {
      this.credentialStore.create(this.buildTarget(credentialSource.reference, credentialStorageBackend), credential);
    } catch (error) {
      if (error instanceof CredentialAlreadyExistsError) {
        this.credentialStore.update(this.buildTarget(credentialSource.reference, credentialStorageBackend), credential);
        return;
      }
      throw error;
    }
  }

  private readStoredCursorCredential(
    reference: string,
    credentialStorageBackend: CredentialStorageBackend | undefined,
  ): CursorWebSessionCredential {
    const credential = this.credentialStore.get(this.buildTarget(reference, credentialStorageBackend));
    if (credential.kind !== "cursor_web_session") {
      throw new CursorUsageBindingValidationError(`Expected cursor_web_session credential for ${reference}`);
    }
    return credential;
  }

  private readStoredCursorCredentialIfPresent(
    reference: string,
    credentialStorageBackend: CredentialStorageBackend | undefined,
  ): CursorWebSessionCredential | null {
    const target = this.buildTarget(reference, credentialStorageBackend);
    return this.credentialStore.has(target)
      ? this.readStoredCursorCredential(reference, credentialStorageBackend)
      : null;
  }

  private restoreCredential(
    credentialSource: CredentialSource,
    credentialStorageBackend: CredentialStorageBackend | undefined,
    credential: CursorWebSessionCredential,
  ): void {
    try {
      this.credentialStore.update(this.buildTarget(credentialSource.reference, credentialStorageBackend), credential);
    } catch {
      throw new CursorUsageBindingValidationError(
        `Failed to restore Cursor quota credential for ${credentialSource.reference}`,
      );
    }
  }

  private recreateCredential(
    credentialSource: CredentialSource,
    credentialStorageBackend: CredentialStorageBackend | undefined,
    credential: CursorWebSessionCredential,
  ): void {
    try {
      this.credentialStore.create(this.buildTarget(credentialSource.reference, credentialStorageBackend), credential);
    } catch {
      throw new CursorUsageBindingValidationError(
        `Failed to restore Cursor quota credential for ${credentialSource.reference}`,
      );
    }
  }

  private removeCredentialIfPresent(
    credentialSource: CredentialSource,
    credentialStorageBackend: CredentialStorageBackend | undefined,
  ): void {
    try {
      this.credentialStore.remove(this.buildTarget(credentialSource.reference, credentialStorageBackend));
    } catch (error) {
      if (error instanceof CredentialNotFoundError) {
        return;
      }
      throw error;
    }
  }

  private restoreMigratedCredential(
    credentialSource: CredentialSource,
    credentialStorageBackend: CredentialStorageBackend | undefined,
    credential: CursorWebSessionCredential | null,
  ): void {
    if (credential) {
      this.restoreCredential(credentialSource, credentialStorageBackend, credential);
      return;
    }
    this.removeCredentialIfPresent(credentialSource, credentialStorageBackend);
  }

  private hasStorageBackendChange(
    previousBackend: CredentialStorageBackend | undefined,
    nextBackend: CredentialStorageBackend | undefined,
  ): boolean {
    return (previousBackend ?? "system_secure_storage") !== (nextBackend ?? "system_secure_storage");
  }

  private buildTarget(reference: string, backend: CredentialStorageBackend | undefined) {
    return buildCredentialStoreTarget(reference, backend);
  }
}
