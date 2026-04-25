import { SecurityCli } from "./SecurityCli";
import { type StoredCredential } from "./Types";
import { NileLogger } from "../../services/NileLogger";
import {
  type CredentialStore,
  CredentialAlreadyExistsError,
  CredentialNotFoundError,
  CredentialStoreCommandError,
  CredentialStoreValidationError,
} from "./Store";

export {
  CredentialAlreadyExistsError,
  CredentialNotFoundError,
  CredentialStoreCommandError,
  CredentialStoreValidationError,
} from "./Store";

export class KeychainCredentialStore implements CredentialStore {
  private readonly cache = new Map<string, StoredCredential>();

  constructor(
    private readonly securityCli: SecurityCli = new SecurityCli(),
    private readonly serviceName: string = "nile.switcher.credential",
    private readonly logger: NileLogger = NileLogger.silent().child({ module: "credential-store" }),
    private readonly validators: Record<string, CredentialValidator> = DEFAULT_CREDENTIAL_VALIDATORS,
  ) {}

  create(credentialId: string, credential: StoredCredential): void {
    this.validateCredentialId(credentialId);
    const serialized = this.serializeCredential(credential);
    this.logger.debug("credential.create.start", {
      credentialId,
      kind: credential.kind,
    });

    const result = this.securityCli.run([
      "add-generic-password",
      "-a",
      credentialId,
      "-s",
      this.serviceName,
      "-w",
      serialized,
    ]);

    if (result.exitCode === 0) {
      this.cache.set(credentialId, credential);
      this.logger.info("credential.create.success", {
        credentialId,
        kind: credential.kind,
      });
      return;
    }
    if (this.isDuplicateError(result)) {
      this.logger.warn("credential.create.duplicate", {
        credentialId,
        kind: credential.kind,
      });
      throw new CredentialAlreadyExistsError(credentialId);
    }

    this.logger.error("credential.create.failed", result.stderr, {
      credentialId,
      kind: credential.kind,
    });
    throw new CredentialStoreCommandError(this.buildCommandError("create", credentialId, result));
  }

  update(credentialId: string, credential: StoredCredential): void {
    this.validateCredentialId(credentialId);
    const serialized = this.serializeCredential(credential);
    this.logger.debug("credential.update.start", {
      credentialId,
      kind: credential.kind,
    });

    if (!this.cache.has(credentialId) && !this.has(credentialId)) {
      throw new CredentialNotFoundError(credentialId);
    }

    const result = this.securityCli.run([
      "add-generic-password",
      "-a",
      credentialId,
      "-s",
      this.serviceName,
      "-U",
      "-w",
      serialized,
    ]);

    if (result.exitCode === 0) {
      this.cache.set(credentialId, credential);
      this.logger.info("credential.update.success", {
        credentialId,
        kind: credential.kind,
      });
      return;
    }

    this.logger.error("credential.update.failed", result.stderr, {
      credentialId,
      kind: credential.kind,
    });
    throw new CredentialStoreCommandError(this.buildCommandError("update", credentialId, result));
  }

  get(credentialId: string): StoredCredential {
    this.validateCredentialId(credentialId);
    const cached = this.cache.get(credentialId);
    if (cached) {
      this.logger.debug("credential.get.cache_hit", { credentialId });
      return cached;
    }

    const result = this.securityCli.run([
      "find-generic-password",
      "-a",
      credentialId,
      "-s",
      this.serviceName,
      "-w",
    ]);

    if (result.exitCode === 0) {
      const credential = this.deserializeCredential(result.stdout);
      this.cache.set(credentialId, credential);
      this.logger.debug("credential.get.success", { credentialId });
      return credential;
    }
    if (this.isMissingError(result)) {
      this.logger.warn("credential.get.missing", { credentialId });
      throw new CredentialNotFoundError(credentialId);
    }

    this.logger.error("credential.get.failed", result.stderr, { credentialId });
    throw new CredentialStoreCommandError(this.buildCommandError("get", credentialId, result));
  }

  has(credentialId: string): boolean {
    this.validateCredentialId(credentialId);
    if (this.cache.has(credentialId)) {
      this.logger.debug("credential.has.cache_hit", { credentialId });
      return true;
    }

    const result = this.securityCli.run([
      "find-generic-password",
      "-a",
      credentialId,
      "-s",
      this.serviceName,
    ]);

    if (result.exitCode === 0) {
      this.logger.debug("credential.has.true", { credentialId });
      return true;
    }
    if (this.isMissingError(result)) {
      this.logger.debug("credential.has.false", { credentialId });
      return false;
    }

    this.logger.error("credential.has.failed", result.stderr, { credentialId });
    throw new CredentialStoreCommandError(this.buildCommandError("has", credentialId, result));
  }

  remove(credentialId: string): void {
    this.validateCredentialId(credentialId);

    const result = this.securityCli.run([
      "delete-generic-password",
      "-a",
      credentialId,
      "-s",
      this.serviceName,
    ]);

    if (result.exitCode === 0) {
      this.cache.delete(credentialId);
      this.logger.info("credential.remove.success", { credentialId });
      return;
    }
    if (this.isMissingError(result)) {
      this.logger.warn("credential.remove.missing", { credentialId });
      throw new CredentialNotFoundError(credentialId);
    }

    this.logger.error("credential.remove.failed", result.stderr, { credentialId });
    throw new CredentialStoreCommandError(this.buildCommandError("remove", credentialId, result));
  }

  private validateCredentialId(credentialId: string): void {
    if (!credentialId.trim()) {
      throw new CredentialStoreValidationError("Credential id is required");
    }
  }

  private serializeCredential(credential: StoredCredential): string {
    this.validateCredential(credential);
    return JSON.stringify(credential);
  }

  private deserializeCredential(raw: string): StoredCredential {
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new CredentialStoreValidationError("Stored credential payload is not valid JSON");
    }

    this.validateCredential(parsed);
    return parsed;
  }

  private validateCredential(credential: unknown): asserts credential is StoredCredential {
    if (typeof credential !== "object" || credential === null || Array.isArray(credential)) {
      throw new CredentialStoreValidationError("Credential payload must be an object");
    }

    const kind = requireStringField(credential, "kind");
    const validator = this.validators[kind];
    if (!validator) {
      throw new CredentialStoreValidationError(`Unsupported credential kind: ${kind}`);
    }
    validator(credential);
  }

  private isDuplicateError(result: SecurityCliResultLike): boolean {
    return /already exists/i.test(result.stderr);
  }

  private isMissingError(result: SecurityCliResultLike): boolean {
    return /could not be found|item not found|errsecitemnotfound/i.test(result.stderr);
  }

  private buildCommandError(action: string, credentialId: string, result: SecurityCliResultLike): string {
    const detail = result.stderr.trim() || `security exited with code ${result.exitCode}`;
    return `Failed to ${action} credential ${credentialId}: ${detail}`;
  }
}

type SecurityCliResultLike = {
  exitCode: number;
  stderr: string;
};

type CredentialValidator = (credential: unknown) => void;

const DEFAULT_CREDENTIAL_VALIDATORS: Record<string, CredentialValidator> = {
  api_key: (credential) => {
    const source = requireOptionalStringField(credential, "source");
    if (!source || source === "direct") {
      requireStringField(credential, "apiKey");
      return;
    }
    if (source === "env_key") {
      requireStringField(credential, "envKey");
      return;
    }
    throw new CredentialStoreValidationError(`Unsupported api_key credential source: ${source}`);
  },
  claude_session: (credential) => {
    requireStringField(credential, "accessToken");
    requireStringField(credential, "refreshToken");
    requireOptionalNumberField(credential, "expiresAt");
    requireOptionalStringField(credential, "accountUuid");
    requireOptionalStringField(credential, "organizationUuid");
    requireOptionalStringField(credential, "email");
    requireOptionalStringField(credential, "displayName");
  },
  openai_session: (credential) => {
    requireStringField(credential, "idToken");
    requireStringField(credential, "accessToken");
    requireStringField(credential, "refreshToken");
    requireOptionalStringField(credential, "accountId");
    requireOptionalStringField(credential, "lastRefresh");
  },
  cursor_session: (credential) => {
    requireStringField(credential, "accessToken");
    requireStringField(credential, "refreshToken");
    requireOptionalStringField(credential, "authId");
    requireOptionalStringField(credential, "authCacheKey");
    requireOptionalStringField(credential, "email");
    requireOptionalStringField(credential, "displayName");
    requireOptionalNumberField(credential, "userId");
  },
  cursor_web_session: (credential) => {
    requireStringField(credential, "sessionToken");
  },
};

function requireStringField(value: unknown, field: string): string {
  const record = value as Record<string, unknown>;
  if (typeof record[field] !== "string" || !record[field]) {
    throw new CredentialStoreValidationError(`Credential field ${field} is required`);
  }
  return record[field] as string;
}

function requireOptionalStringField(value: unknown, field: string): string | undefined {
  const record = value as Record<string, unknown>;
  if (record[field] === undefined) {
    return undefined;
  }
  if (typeof record[field] !== "string" || !record[field]) {
    throw new CredentialStoreValidationError(`Credential field ${field} must be a non-empty string`);
  }
  return record[field] as string;
}

function requireOptionalNumberField(value: unknown, field: string): number | undefined {
  const record = value as Record<string, unknown>;
  if (record[field] === undefined) {
    return undefined;
  }
  if (typeof record[field] !== "number" || Number.isNaN(record[field])) {
    throw new CredentialStoreValidationError(`Credential field ${field} must be a valid number`);
  }
  return record[field] as number;
}
