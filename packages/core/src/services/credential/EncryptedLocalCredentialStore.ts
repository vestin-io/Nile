import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { readOptionalTextFile } from "../OptionalTextFile";
import { writePrivateTextFile } from "../PrivateTextFile";
import type { StoredCredential } from "./Types";
import {
  type CredentialStore,
  type CredentialStoreTarget,
  CredentialAlreadyExistsError,
  CredentialNotFoundError,
  CredentialStoreValidationError,
  EncryptedLocalCredentialStoreCorruptedError,
  EncryptedLocalCredentialStoreLockedError,
  EncryptedLocalCredentialStorePassphraseError,
  normalizeCredentialStoreTarget,
} from "./Store";

type VaultFile = {
  schemaVersion: 1;
  kdf: {
    algorithm: "scrypt";
    saltBase64: string;
    cost: number;
    blockSize: number;
    parallelization: number;
    keyLength: number;
  };
  verification: VaultCiphertext;
  entries: Record<string, VaultCiphertext>;
};

type VaultCiphertext = {
  nonceBase64: string;
  ciphertextBase64: string;
  tagBase64: string;
};

const DEFAULT_KDF = {
  algorithm: "scrypt" as const,
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
  keyLength: 32,
};

const VERIFICATION_TEXT = "nile.encrypted-local-storage.v1";

export class EncryptedLocalCredentialStore implements CredentialStore {
  private unlockedKey: Buffer | null = null;

  constructor(private readonly vaultPath: string) {}

  hasVault(): boolean {
    return readOptionalTextFile(this.vaultPath, "encrypted credential vault") !== null;
  }

  isUnlocked(): boolean {
    return this.unlockedKey !== null;
  }

  clearUnlockedKey(): void {
    this.unlockedKey?.fill(0);
    this.unlockedKey = null;
  }

  unlock(passphrase: string): void {
    const normalizedPassphrase = passphrase.trim();
    if (!normalizedPassphrase) {
      throw new EncryptedLocalCredentialStorePassphraseError("Encrypted local storage passphrase is required.");
    }
    const existing = this.readVault();
    if (!existing) {
      const created = this.createEmptyVault(normalizedPassphrase);
      this.writeVault(created.file);
      this.unlockedKey = created.key;
      return;
    }
    const key = this.deriveKey(normalizedPassphrase, existing.kdf);
    const verification = this.decrypt(existing.verification, key);
    if (!timingSafeEqual(Buffer.from(verification, "utf8"), Buffer.from(VERIFICATION_TEXT, "utf8"))) {
      key.fill(0);
      throw new EncryptedLocalCredentialStorePassphraseError();
    }
    this.clearUnlockedKey();
    this.unlockedKey = key;
  }

  create(target: CredentialStoreTarget, credential: StoredCredential): void {
    const reference = normalizeCredentialStoreTarget(target).reference;
    const vault = this.requireVault();
    if (vault.entries[reference]) {
      throw new CredentialAlreadyExistsError(reference);
    }
    vault.entries[reference] = this.encrypt(this.serializeCredential(credential), this.requireUnlockedKey());
    this.writeVault(vault);
  }

  update(target: CredentialStoreTarget, credential: StoredCredential): void {
    const reference = normalizeCredentialStoreTarget(target).reference;
    const vault = this.requireVault();
    if (!vault.entries[reference]) {
      throw new CredentialNotFoundError(reference);
    }
    vault.entries[reference] = this.encrypt(this.serializeCredential(credential), this.requireUnlockedKey());
    this.writeVault(vault);
  }

  get(target: CredentialStoreTarget): StoredCredential {
    const reference = normalizeCredentialStoreTarget(target).reference;
    const vault = this.requireVault();
    const entry = vault.entries[reference];
    if (!entry) {
      throw new CredentialNotFoundError(reference);
    }
    return this.deserializeCredential(this.decrypt(entry, this.requireUnlockedKey()));
  }

  has(target: CredentialStoreTarget): boolean {
    const reference = normalizeCredentialStoreTarget(target).reference;
    const vault = this.readVault();
    if (!vault) {
      return false;
    }
    if (!this.unlockedKey) {
      throw new EncryptedLocalCredentialStoreLockedError();
    }
    return Boolean(vault.entries[reference]);
  }

  remove(target: CredentialStoreTarget): void {
    const reference = normalizeCredentialStoreTarget(target).reference;
    const vault = this.requireVault();
    if (!vault.entries[reference]) {
      throw new CredentialNotFoundError(reference);
    }
    delete vault.entries[reference];
    this.writeVault(vault);
  }

  private requireVault(): VaultFile {
    const vault = this.readVault();
    if (!vault) {
      throw new CredentialNotFoundError("encrypted-local-vault");
    }
    this.requireUnlockedKey();
    return vault;
  }

  private requireUnlockedKey(): Buffer {
    if (!this.unlockedKey) {
      throw new EncryptedLocalCredentialStoreLockedError();
    }
    return this.unlockedKey;
  }

  private createEmptyVault(passphrase: string): { file: VaultFile; key: Buffer } {
    const kdf = {
      ...DEFAULT_KDF,
      saltBase64: randomBytes(16).toString("base64"),
    };
    const key = this.deriveKey(passphrase, kdf);
    return {
      key,
      file: {
        schemaVersion: 1,
        kdf,
        verification: this.encrypt(VERIFICATION_TEXT, key),
        entries: {},
      },
    };
  }

  private deriveKey(passphrase: string, kdf: VaultFile["kdf"]): Buffer {
    return scryptSync(passphrase, Buffer.from(kdf.saltBase64, "base64"), kdf.keyLength, {
      N: kdf.cost,
      r: kdf.blockSize,
      p: kdf.parallelization,
    });
  }

  private encrypt(plaintext: string, key: Buffer): VaultCiphertext {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      nonceBase64: nonce.toString("base64"),
      ciphertextBase64: ciphertext.toString("base64"),
      tagBase64: tag.toString("base64"),
    };
  }

  private decrypt(ciphertext: VaultCiphertext, key: Buffer): string {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ciphertext.nonceBase64, "base64"));
      decipher.setAuthTag(Buffer.from(ciphertext.tagBase64, "base64"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ciphertext.ciphertextBase64, "base64")),
        decipher.final(),
      ]);
      return plaintext.toString("utf8");
    } catch {
      throw new EncryptedLocalCredentialStorePassphraseError(
        "Encrypted local storage could not be unlocked. The passphrase may be wrong or the vault may be corrupted.",
      );
    }
  }

  private readVault(): VaultFile | null {
    const raw = readOptionalTextFile(this.vaultPath, "encrypted credential vault");
    if (raw === null) {
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new EncryptedLocalCredentialStoreCorruptedError("Encrypted local storage vault is not valid JSON.");
    }
    try {
      return this.validateVaultFile(parsed);
    } catch (error) {
      if (error instanceof CredentialStoreValidationError) {
        throw new EncryptedLocalCredentialStoreCorruptedError(error.message);
      }
      throw error;
    }
  }

  private writeVault(vault: VaultFile): void {
    writePrivateTextFile(this.vaultPath, JSON.stringify(vault));
  }

  private serializeCredential(credential: StoredCredential): string {
    return JSON.stringify(credential);
  }

  private deserializeCredential(raw: string): StoredCredential {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new CredentialStoreValidationError("Stored credential payload is not valid JSON.");
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new CredentialStoreValidationError("Stored credential payload must be an object.");
    }
    const kind = (parsed as { kind?: unknown }).kind;
    if (typeof kind !== "string" || !kind.trim()) {
      throw new CredentialStoreValidationError("Stored credential kind is required.");
    }
    return parsed as StoredCredential;
  }

  private validateVaultFile(value: unknown): VaultFile {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new CredentialStoreValidationError("Encrypted local storage vault must be an object.");
    }
    const record = value as Record<string, unknown>;
    if (record.schemaVersion !== 1) {
      throw new CredentialStoreValidationError("Encrypted local storage vault version is unsupported.");
    }
    const kdf = this.validateKdf(record.kdf);
    const verification = this.validateCiphertext(record.verification, "verification");
    const entriesRecord = record.entries;
    if (typeof entriesRecord !== "object" || entriesRecord === null || Array.isArray(entriesRecord)) {
      throw new CredentialStoreValidationError("Encrypted local storage entries must be an object.");
    }
    const entries: Record<string, VaultCiphertext> = {};
    for (const [reference, entry] of Object.entries(entriesRecord)) {
      entries[reference] = this.validateCiphertext(entry, `entry ${reference}`);
    }
    return {
      schemaVersion: 1,
      kdf,
      verification,
      entries,
    };
  }

  private validateKdf(value: unknown): VaultFile["kdf"] {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new CredentialStoreValidationError("Encrypted local storage KDF metadata is invalid.");
    }
    const record = value as Record<string, unknown>;
    if (record.algorithm !== "scrypt") {
      throw new CredentialStoreValidationError("Encrypted local storage KDF algorithm is unsupported.");
    }
    return {
      algorithm: "scrypt",
      saltBase64: this.requireString(record.saltBase64, "kdf.saltBase64"),
      cost: this.requireNumber(record.cost, "kdf.cost"),
      blockSize: this.requireNumber(record.blockSize, "kdf.blockSize"),
      parallelization: this.requireNumber(record.parallelization, "kdf.parallelization"),
      keyLength: this.requireNumber(record.keyLength, "kdf.keyLength"),
    };
  }

  private validateCiphertext(value: unknown, label: string): VaultCiphertext {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new CredentialStoreValidationError(`Encrypted local storage ${label} is invalid.`);
    }
    const record = value as Record<string, unknown>;
    return {
      nonceBase64: this.requireString(record.nonceBase64, `${label}.nonceBase64`),
      ciphertextBase64: this.requireString(record.ciphertextBase64, `${label}.ciphertextBase64`),
      tagBase64: this.requireString(record.tagBase64, `${label}.tagBase64`),
    };
  }

  private requireString(value: unknown, field: string): string {
    if (typeof value !== "string" || !value.trim()) {
      throw new CredentialStoreValidationError(`${field} must be a non-empty string.`);
    }
    return value;
  }

  private requireNumber(value: unknown, field: string): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
      throw new CredentialStoreValidationError(`${field} must be a positive number.`);
    }
    return value;
  }
}
