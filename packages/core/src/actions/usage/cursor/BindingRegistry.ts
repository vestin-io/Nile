import {
  type CredentialStore,
  CredentialAlreadyExistsError,
  CredentialNotFoundError,
} from "../../../services/credential/Store";
import {
  LocalCredentialSourceFactory,
  type CredentialSourceFactory,
} from "../../../services/credential/Factory";
import type { CredentialSource } from "../../../services/credential/Source";
import type { CursorWebSessionCredential } from "../../../services/credential/Types";
import { SqliteDatabase } from "../../../services/database/SqliteDatabase";
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
      const previousCredential = this.readStoredCursorCredential(existing.credentialSource.reference);
      this.credentialStore.update(existing.credentialSource.reference, credential);
      try {
        this.bindingStore.update({
          ...record,
          credentialSource: existing.credentialSource,
          createdAt: existing.createdAt,
          updatedAt: createdAt,
        });
      } catch (error) {
        this.restoreCredential(existing.credentialSource, previousCredential);
        throw error;
      }
      return this.getOrThrow(record.connectionId);
    }

    this.createCredential(record.credentialSource, credential);
    try {
      this.bindingStore.insert(record);
    } catch (error) {
      this.removeCredentialIfPresent(record.credentialSource);
      throw error;
    }
    return this.getOrThrow(record.connectionId);
  }

  get(connectionId: string): CursorUsageBindingRecord | null {
    return this.bindingStore.get(connectionId);
  }

  readCredential(connectionId: string): CursorWebSessionCredential {
    const binding = this.getOrThrow(connectionId);
    const credential = this.credentialStore.get(binding.credentialSource.reference);
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

    const previousCredential = this.readStoredCursorCredential(existing.credentialSource.reference);
    this.credentialStore.remove(existing.credentialSource.reference);
    try {
      this.bindingStore.remove(connectionId);
    } catch (error) {
      this.recreateCredential(existing.credentialSource, previousCredential);
      throw error;
    }
  }

  close(): void {
    this.ownedDatabase?.close();
  }

  private getOrThrow(connectionId: string): CursorUsageBindingRecord {
    const record = this.bindingStore.get(connectionId);
    if (!record) {
      throw new CursorUsageBindingValidationError(`Cursor usage binding not found: ${connectionId}`);
    }
    return record;
  }

  private normalizeInput(input: CursorUsageBindingInput, timestamp: string): CursorUsageBindingRecord {
    const connectionId = input.connectionId.trim();
    if (!connectionId) {
      throw new CursorUsageBindingValidationError("Cursor usage binding connection id is required");
    }

    const authId = input.accountFingerprint.authId.trim();
    const workosUserId = input.accountFingerprint.workosUserId.trim();
    const email = input.accountFingerprint.email?.trim();
    if (!authId) {
      throw new CursorUsageBindingValidationError("Cursor usage binding authId is required");
    }
    if (!workosUserId) {
      throw new CursorUsageBindingValidationError("Cursor usage binding workosUserId is required");
    }

    return {
      connectionId,
      accountFingerprint: {
        authId,
        workosUserId,
        ...(email ? { email } : {}),
      },
      credentialSource: this.credentialSourceFactory.createCursorUsageSource({ connectionId }),
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

  private createCredential(credentialSource: CredentialSource, credential: CursorWebSessionCredential): void {
    try {
      this.credentialStore.create(credentialSource.reference, credential);
    } catch (error) {
      if (error instanceof CredentialAlreadyExistsError) {
        this.credentialStore.update(credentialSource.reference, credential);
        return;
      }
      throw error;
    }
  }

  private readStoredCursorCredential(reference: string): CursorWebSessionCredential {
    const credential = this.credentialStore.get(reference);
    if (credential.kind !== "cursor_web_session") {
      throw new CursorUsageBindingValidationError(`Expected cursor_web_session credential for ${reference}`);
    }
    return credential;
  }

  private restoreCredential(credentialSource: CredentialSource, credential: CursorWebSessionCredential): void {
    try {
      this.credentialStore.update(credentialSource.reference, credential);
    } catch {
      throw new CursorUsageBindingValidationError(
        `Failed to restore Cursor usage credential for ${credentialSource.reference}`,
      );
    }
  }

  private recreateCredential(credentialSource: CredentialSource, credential: CursorWebSessionCredential): void {
    try {
      this.credentialStore.create(credentialSource.reference, credential);
    } catch {
      throw new CursorUsageBindingValidationError(
        `Failed to restore Cursor usage credential for ${credentialSource.reference}`,
      );
    }
  }

  private removeCredentialIfPresent(credentialSource: CredentialSource): void {
    try {
      this.credentialStore.remove(credentialSource.reference);
    } catch (error) {
      if (error instanceof CredentialNotFoundError) {
        return;
      }
      throw error;
    }
  }
}
