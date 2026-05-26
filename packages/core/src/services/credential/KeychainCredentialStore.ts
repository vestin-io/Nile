import { GenericPasswordWriter } from "./GenericPasswordWriter";
import { SecuritySecretCodec } from "./SecretCodec";
import { type StoredCredential } from "./Types";
import {
  type CredentialValidator,
  DEFAULT_CREDENTIAL_VALIDATORS,
  StoredCredentialCodec,
} from "./StoredCredentialCodec";
import { NileLogger } from "../../services/NileLogger";
import {
  type CredentialStore,
  type CredentialStoreTarget,
  CredentialAlreadyExistsError,
  CredentialNotFoundError,
  CredentialStoreCommandError,
  SystemSecureCredentialStoreDeniedError,
  CredentialStoreValidationError,
  normalizeCredentialStoreTarget,
} from "./Store";

export {
  CredentialAlreadyExistsError,
  CredentialNotFoundError,
  CredentialStoreCommandError,
  CredentialStoreValidationError,
  SystemSecureCredentialStoreDeniedError,
} from "./Store";

export class KeychainCredentialStore implements CredentialStore {
  private readonly cache = new Map<string, StoredCredential>();
  private readonly codec: StoredCredentialCodec;

  constructor(
    private readonly serviceName: string = "nile.switcher.credential",
    private readonly logger: NileLogger = NileLogger.silent().child({ module: "credential-store" }),
    private readonly validators: Record<string, CredentialValidator> = DEFAULT_CREDENTIAL_VALIDATORS,
    private readonly secretCodec: SecuritySecretCodec = new SecuritySecretCodec(),
    private readonly genericPasswordWriter: GenericPasswordWriter = new GenericPasswordWriter(),
  ) {
    this.codec = new StoredCredentialCodec(
      (value) => this.secretCodec.encode(value),
      (value) => this.secretCodec.decode(value),
      this.validators,
    );
  }

  create(target: CredentialStoreTarget, credential: StoredCredential): void {
    const credentialId = normalizeCredentialStoreTarget(target).reference;
    this.validateCredentialId(credentialId);
    const serialized = this.codec.serialize(credential);
    this.logger.debug("credential.create.start", {
      credentialId,
      kind: credential.kind,
    });

    const result = this.genericPasswordWriter.write({
      account: credentialId,
      service: this.serviceName,
      secret: serialized,
      update: false,
    });

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
    if (this.isAccessDeniedError(result)) {
      this.logger.warn("credential.create.denied", {
        credentialId,
        kind: credential.kind,
      });
      throw new SystemSecureCredentialStoreDeniedError();
    }

    this.logger.error("credential.create.failed", result.stderr, {
      credentialId,
      kind: credential.kind,
    });
    throw new CredentialStoreCommandError(this.buildCommandError("create", credentialId, result));
  }

  update(target: CredentialStoreTarget, credential: StoredCredential): void {
    const credentialId = normalizeCredentialStoreTarget(target).reference;
    this.validateCredentialId(credentialId);
    const serialized = this.codec.serialize(credential);
    this.logger.debug("credential.update.start", {
      credentialId,
      kind: credential.kind,
    });

    if (!this.cache.has(credentialId) && !this.has(credentialId)) {
      throw new CredentialNotFoundError(credentialId);
    }

    const result = this.genericPasswordWriter.write({
      account: credentialId,
      service: this.serviceName,
      secret: serialized,
      update: true,
    });

    if (result.exitCode === 0) {
      this.cache.set(credentialId, credential);
      this.logger.info("credential.update.success", {
        credentialId,
        kind: credential.kind,
      });
      return;
    }
    if (this.isAccessDeniedError(result)) {
      this.logger.warn("credential.update.denied", {
        credentialId,
        kind: credential.kind,
      });
      throw new SystemSecureCredentialStoreDeniedError();
    }

    this.logger.error("credential.update.failed", result.stderr, {
      credentialId,
      kind: credential.kind,
    });
    throw new CredentialStoreCommandError(this.buildCommandError("update", credentialId, result));
  }

  get(target: CredentialStoreTarget): StoredCredential {
    const credentialId = normalizeCredentialStoreTarget(target).reference;
    this.validateCredentialId(credentialId);
    const cached = this.cache.get(credentialId);
    if (cached) {
      this.logger.debug("credential.get.cache_hit", { credentialId });
      return cached;
    }

    const result = this.genericPasswordWriter.read({
      account: credentialId,
      service: this.serviceName,
      includeSecret: true,
    });

    if (result.exitCode === 0) {
      const credential = this.codec.deserialize(result.stdout);
      this.cache.set(credentialId, credential);
      this.logger.debug("credential.get.success", { credentialId });
      return credential;
    }
    if (this.isMissingError(result)) {
      this.logger.warn("credential.get.missing", { credentialId });
      throw new CredentialNotFoundError(credentialId);
    }
    if (this.isAccessDeniedError(result)) {
      this.logger.warn("credential.get.denied", { credentialId });
      throw new SystemSecureCredentialStoreDeniedError();
    }

    this.logger.error("credential.get.failed", result.stderr, { credentialId });
    throw new CredentialStoreCommandError(this.buildCommandError("get", credentialId, result));
  }

  has(target: CredentialStoreTarget): boolean {
    const credentialId = normalizeCredentialStoreTarget(target).reference;
    this.validateCredentialId(credentialId);
    if (this.cache.has(credentialId)) {
      this.logger.debug("credential.has.cache_hit", { credentialId });
      return true;
    }

    const result = this.genericPasswordWriter.read({
      account: credentialId,
      service: this.serviceName,
      includeSecret: false,
    });

    if (result.exitCode === 0) {
      this.logger.debug("credential.has.true", { credentialId });
      return true;
    }
    if (this.isMissingError(result)) {
      this.logger.debug("credential.has.false", { credentialId });
      return false;
    }
    if (this.isAccessDeniedError(result)) {
      this.logger.warn("credential.has.denied", { credentialId });
      throw new SystemSecureCredentialStoreDeniedError();
    }

    this.logger.error("credential.has.failed", result.stderr, { credentialId });
    throw new CredentialStoreCommandError(this.buildCommandError("has", credentialId, result));
  }

  remove(target: CredentialStoreTarget): void {
    const credentialId = normalizeCredentialStoreTarget(target).reference;
    this.validateCredentialId(credentialId);

    const result = this.genericPasswordWriter.remove({
      account: credentialId,
      service: this.serviceName,
    });

    if (result.exitCode === 0) {
      this.cache.delete(credentialId);
      this.logger.info("credential.remove.success", { credentialId });
      return;
    }
    if (this.isMissingError(result)) {
      this.logger.warn("credential.remove.missing", { credentialId });
      throw new CredentialNotFoundError(credentialId);
    }
    if (this.isAccessDeniedError(result)) {
      this.logger.warn("credential.remove.denied", { credentialId });
      throw new SystemSecureCredentialStoreDeniedError();
    }

    this.logger.error("credential.remove.failed", result.stderr, { credentialId });
    throw new CredentialStoreCommandError(this.buildCommandError("remove", credentialId, result));
  }

  private validateCredentialId(credentialId: string): void {
    if (!credentialId.trim()) {
      throw new CredentialStoreValidationError("Credential id is required");
    }
  }

  private isDuplicateError(result: SecurityCliResultLike): boolean {
    return /already exists/i.test(result.stderr);
  }

  private isMissingError(result: SecurityCliResultLike): boolean {
    return /could not be found|item not found|errsecitemnotfound/i.test(result.stderr);
  }

  private isAccessDeniedError(result: SecurityCliResultLike): boolean {
    const detail = `${result.stderr}\n${result.errorMessage ?? ""}`;
    return /user interaction is not allowed|authorization was denied|user canceled|errsecauthfailed/i.test(detail);
  }

  private buildCommandError(action: string, credentialId: string, result: SecurityCliResultLike): string {
    const detail = result.stderr.trim() || result.errorMessage?.trim() || `security exited with code ${result.exitCode}`;
    return `Failed to ${action} credential ${credentialId}: ${detail}`;
  }
}

type SecurityCliResultLike = {
  exitCode: number;
  stderr: string;
  errorMessage?: string;
};
