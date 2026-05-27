import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

import { isAgentId, type AgentId } from "../../models/agent/Definitions";
import { SUPPORTED_AUTH_MODES, type AuthMode } from "../../models/access";
import { StoredCredentialCodec } from "./StoredCredentialCodec";
import {
  PortableBundlePassphraseError,
  PortableBundleValidationError,
  PortableBundleVersionError,
} from "./PortableBundleErrors";
import type {
  PortableBundleConnection,
  PortableBundleEnvelope,
  PortableBundlePayload,
  PortableBundlePlatform,
  PortableBundleSource,
} from "./PortableBundleTypes";

const DEFAULT_KDF = {
  algorithm: "scrypt" as const,
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
  keyLength: 32,
};

export type CreatePortableBundleInput = {
  source: PortableBundleSource;
  connections: PortableBundleConnection[];
  exportedAt?: string;
};

export class PortableBundleCodec {
  private readonly credentialCodec = new StoredCredentialCodec();

  create(input: CreatePortableBundleInput, passphrase: string): PortableBundleEnvelope {
    const normalizedPassphrase = requireNonEmptyString(passphrase, "export passphrase");
    const payload = this.normalizePayload({
      version: 1,
      exportedAt: input.exportedAt ?? new Date().toISOString(),
      source: input.source,
      connections: input.connections,
    });
    const kdf = {
      ...DEFAULT_KDF,
      saltBase64: randomBytes(16).toString("base64"),
    };
    const key = this.deriveKey(normalizedPassphrase, kdf);
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(payload), "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    key.fill(0);
    return {
      version: 1,
      format: "nile-portable-bundle",
      kdf,
      cipher: {
        algorithm: "aes-256-gcm",
        nonceBase64: nonce.toString("base64"),
        tagBase64: tag.toString("base64"),
      },
      ciphertextBase64: ciphertext.toString("base64"),
    };
  }

  open(raw: string, passphrase: string): PortableBundlePayload {
    const normalizedPassphrase = requireNonEmptyString(passphrase, "export passphrase");
    const parsed = this.parseEnvelope(raw);
    const key = this.deriveKey(normalizedPassphrase, parsed.kdf);
    let plaintext: Buffer;
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(parsed.cipher.nonceBase64, "base64"),
      );
      decipher.setAuthTag(Buffer.from(parsed.cipher.tagBase64, "base64"));
      plaintext = Buffer.concat([
        decipher.update(Buffer.from(parsed.ciphertextBase64, "base64")),
        decipher.final(),
      ]);
    } catch {
      throw new PortableBundlePassphraseError();
    } finally {
      key.fill(0);
    }
    return this.parsePayload(plaintext.toString("utf8"));
  }

  private parseEnvelope(raw: string): PortableBundleEnvelope {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new PortableBundleValidationError("Portable bundle is not valid JSON.");
    }
    return this.validateEnvelope(parsed);
  }

  private parsePayload(raw: string): PortableBundlePayload {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new PortableBundleValidationError("Portable bundle payload is not valid JSON.");
    }
    return this.normalizePayload(parsed);
  }

  private deriveKey(passphrase: string, kdf: PortableBundleEnvelope["kdf"]): Buffer {
    return scryptSync(passphrase, Buffer.from(kdf.saltBase64, "base64"), kdf.keyLength, {
      N: kdf.cost,
      r: kdf.blockSize,
      p: kdf.parallelization,
    });
  }

  private validateEnvelope(value: unknown): PortableBundleEnvelope {
    const record = requireObject(value, "portable bundle");
    if (record.version !== 1) {
      throw new PortableBundleVersionError();
    }
    if (record.format !== "nile-portable-bundle") {
      throw new PortableBundleValidationError("Portable bundle format is invalid.");
    }
    const kdf = requireObject(record.kdf, "portable bundle KDF metadata");
    if (kdf.algorithm !== "scrypt") {
      throw new PortableBundleVersionError("Portable bundle KDF algorithm is unsupported.");
    }
    const cipher = requireObject(record.cipher, "portable bundle cipher metadata");
    if (cipher.algorithm !== "aes-256-gcm") {
      throw new PortableBundleVersionError("Portable bundle cipher algorithm is unsupported.");
    }
    return {
      version: 1,
      format: "nile-portable-bundle",
      kdf: {
        algorithm: "scrypt",
        saltBase64: requireNonEmptyString(kdf.saltBase64, "portable bundle KDF salt"),
        cost: requirePositiveNumber(kdf.cost, "portable bundle KDF cost"),
        blockSize: requirePositiveNumber(kdf.blockSize, "portable bundle KDF block size"),
        parallelization: requirePositiveNumber(kdf.parallelization, "portable bundle KDF parallelization"),
        keyLength: requirePositiveNumber(kdf.keyLength, "portable bundle KDF key length"),
      },
      cipher: {
        algorithm: "aes-256-gcm",
        nonceBase64: requireNonEmptyString(cipher.nonceBase64, "portable bundle cipher nonce"),
        tagBase64: requireNonEmptyString(cipher.tagBase64, "portable bundle cipher tag"),
      },
      ciphertextBase64: requireNonEmptyString(record.ciphertextBase64, "portable bundle ciphertext"),
    };
  }

  private normalizePayload(value: unknown): PortableBundlePayload {
    const record = requireObject(value, "portable bundle payload");
    if (record.version !== 1) {
      throw new PortableBundleVersionError("Portable bundle payload version is unsupported.");
    }
    const source = this.normalizeSource(record.source);
    const rawConnections = record.connections;
    if (!Array.isArray(rawConnections)) {
      throw new PortableBundleValidationError("Portable bundle connections must be an array.");
    }
    return {
      version: 1,
      exportedAt: requireNonEmptyString(record.exportedAt, "portable bundle exportedAt"),
      source,
      connections: rawConnections.map((entry, index) =>
        this.normalizeConnection(entry, `portable bundle connection ${index}`),
      ),
    };
  }

  private normalizeSource(value: unknown): PortableBundleSource {
    const record = requireObject(value, "portable bundle source");
    return {
      appVersion: requireNonEmptyString(record.appVersion, "portable bundle source appVersion"),
      platform: this.normalizePlatform(record.platform),
      storageMode: this.normalizeStorageMode(record.storageMode),
    };
  }

  private normalizeConnection(value: unknown, label: string): PortableBundleConnection {
    const record = requireObject(value, label);
    const modelSelections = this.normalizeModelSelections(record.modelSelections);
    const identityKey = this.normalizeOptionalNullableString(record.identityKey, `${label} identityKey`);
    return {
      stableKey: requireNonEmptyString(record.stableKey, `${label} stableKey`),
      label: requireNonEmptyString(record.label, `${label} label`),
      endpointId: requireNonEmptyString(record.endpointId, `${label} endpointId`),
      endpointFamily: this.normalizeEndpointFamily(record.endpointFamily, `${label} endpointFamily`),
      endpointUrl: this.normalizeOptionalString(record.endpointUrl, `${label} endpointUrl`),
      authMode: this.normalizeAuthMode(record.authMode, `${label} authMode`),
      ...(identityKey !== undefined ? { identityKey } : {}),
      enabledAgents: this.normalizeAgentIds(record.enabledAgents, `${label} enabledAgents`),
      configurableAgents: this.normalizeAgentIds(record.configurableAgents, `${label} configurableAgents`),
      selectedByAgents: this.normalizeStringArray(record.selectedByAgents, `${label} selectedByAgents`),
      ...(modelSelections ? { modelSelections } : {}),
      credential: this.credentialCodec.parse(record.credential),
    };
  }

  private normalizeModelSelections(value: unknown): Record<string, string | null> | undefined {
    if (value === undefined) {
      return undefined;
    }
    const record = requireObject(value, "portable bundle model selections");
    const selections: Record<string, string | null> = {};
    for (const [key, candidate] of Object.entries(record)) {
      if (!isAgentId(key)) {
        throw new PortableBundleValidationError(`portable bundle model selection ${key} uses an unsupported agent id.`);
      }
      if (candidate === null) {
        selections[key] = null;
        continue;
      }
      selections[key] = requireNonEmptyString(candidate, `portable bundle model selection ${key}`);
    }
    return selections;
  }

  private normalizeStringArray(value: unknown, label: string): string[] {
    if (!Array.isArray(value)) {
      throw new PortableBundleValidationError(`${label} must be an array.`);
    }
    return value.map((entry) => requireNonEmptyString(entry, label));
  }

  private normalizeAgentIds(value: unknown, label: string): AgentId[] {
    return this.normalizeStringArray(value, label).map((entry) => {
      if (!isAgentId(entry)) {
        throw new PortableBundleValidationError(`${label} contains an unsupported agent id.`);
      }
      return entry as AgentId;
    });
  }

  private normalizeOptionalString(value: unknown, label: string): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    return requireNonEmptyString(value, label);
  }

  private normalizeOptionalNullableString(value: unknown, label: string): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    return requireNonEmptyString(value, label);
  }

  private normalizeAuthMode(value: unknown, label: string): AuthMode {
    const normalized = requireNonEmptyString(value, label) as AuthMode;
    if (!SUPPORTED_AUTH_MODES.includes(normalized)) {
      throw new PortableBundleValidationError(`${label} is unsupported.`);
    }
    return normalized;
  }

  private normalizeEndpointFamily(value: unknown, label: string): PortableBundleConnection["endpointFamily"] {
    return requireNonEmptyString(value, label) as PortableBundleConnection["endpointFamily"];
  }

  private normalizePlatform(value: unknown): PortableBundlePlatform {
    const normalized = requireNonEmptyString(value, "portable bundle platform");
    if (normalized !== "macos" && normalized !== "windows" && normalized !== "linux") {
      throw new PortableBundleValidationError("Portable bundle platform is unsupported.");
    }
    return normalized;
  }

  private normalizeStorageMode(value: unknown): PortableBundleSource["storageMode"] {
    const normalized = requireNonEmptyString(value, "portable bundle storage mode");
    if (normalized !== "system_secure_storage" && normalized !== "encrypted_local_storage") {
      throw new PortableBundleValidationError("Portable bundle storage mode is unsupported.");
    }
    return normalized;
  }
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PortableBundleValidationError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new PortableBundleValidationError(`${label} must be a non-empty string.`);
  }
  return value;
}

function requirePositiveNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    throw new PortableBundleValidationError(`${label} must be a positive number.`);
  }
  return value;
}
