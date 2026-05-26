import { NileLogger } from "../../services/NileLogger";
import { type StoredCredential } from "./Types";
import {
  WindowsSecretAccessDeniedError,
  WindowsSecretNotFoundError,
  WindowsSecretStore,
  WindowsSecretStoreError,
  WindowsSecretValidationError,
} from "./WindowsSecretStore";
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
import { StoredCredentialCodec } from "./StoredCredentialCodec";
import { WindowsCredentialWriter } from "./WindowsCredentialWriter";

export class WindowsCredentialManagerStore implements CredentialStore {
  private readonly cache = new Map<string, StoredCredential>();
  private readonly secrets: Pick<WindowsSecretStore, "write" | "read" | "has" | "remove">;

  constructor(
    private readonly serviceName: string = "nile.switcher.credential",
    private readonly logger: NileLogger = NileLogger.silent().child({ module: "windows-credential-store" }),
    private readonly codec: StoredCredentialCodec = new StoredCredentialCodec(),
    secretsOrWriter?:
      | Pick<WindowsSecretStore, "write" | "read" | "has" | "remove">
      | Pick<WindowsCredentialWriter, "write" | "read" | "remove">,
  ) {
    this.secrets = this.readSecrets(secretsOrWriter);
  }

  create(target: CredentialStoreTarget, credential: StoredCredential): void {
    const credentialId = normalizeCredentialStoreTarget(target).reference;
    this.validateCredentialId(credentialId);
    const serialized = this.codec.serialize(credential);
    this.logger.debug("credential.create.start", {
      credentialId,
      kind: credential.kind,
    });

    if (this.has(credentialId)) {
      this.logger.warn("credential.create.duplicate", {
        credentialId,
        kind: credential.kind,
      });
      throw new CredentialAlreadyExistsError(credentialId);
    }

    try {
      this.secrets.write(credentialId, serialized);
      this.cache.set(credentialId, credential);
      this.logger.info("credential.create.success", {
        credentialId,
        kind: credential.kind,
      });
      return;
    } catch (error) {
      this.rethrowCommandError("create", credentialId, credential.kind, error);
    }
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

    try {
      this.secrets.write(credentialId, serialized);
      this.cache.set(credentialId, credential);
      this.logger.info("credential.update.success", {
        credentialId,
        kind: credential.kind,
      });
      return;
    } catch (error) {
      this.rethrowCommandError("update", credentialId, credential.kind, error);
    }
  }

  get(target: CredentialStoreTarget): StoredCredential {
    const credentialId = normalizeCredentialStoreTarget(target).reference;
    this.validateCredentialId(credentialId);
    const cached = this.cache.get(credentialId);
    if (cached) {
      this.logger.debug("credential.get.cache_hit", { credentialId });
      return cached;
    }

    try {
      const credential = this.codec.deserialize(this.secrets.read(credentialId));
      this.cache.set(credentialId, credential);
      this.logger.debug("credential.get.success", { credentialId });
      return credential;
    } catch (error) {
      this.rethrowCommandError("get", credentialId, undefined, error);
    }
  }

  has(target: CredentialStoreTarget): boolean {
    const credentialId = normalizeCredentialStoreTarget(target).reference;
    this.validateCredentialId(credentialId);
    if (this.cache.has(credentialId)) {
      this.logger.debug("credential.has.cache_hit", { credentialId });
      return true;
    }

    try {
      const present = this.secrets.has(credentialId);
      this.logger.debug(`credential.has.${present ? "true" : "false"}`, { credentialId });
      return present;
    } catch (error) {
      if (error instanceof WindowsSecretAccessDeniedError) {
        this.logger.warn("credential.has.denied", { credentialId });
        throw new SystemSecureCredentialStoreDeniedError();
      }
      if (error instanceof WindowsSecretStoreError) {
        this.logger.error("credential.has.failed", error.message, { credentialId });
        throw new CredentialStoreCommandError(`Failed to has credential ${credentialId}: ${error.message}`);
      }
      throw error;
    }
  }

  remove(target: CredentialStoreTarget): void {
    const credentialId = normalizeCredentialStoreTarget(target).reference;
    this.validateCredentialId(credentialId);

    try {
      this.secrets.remove(credentialId);
      this.cache.delete(credentialId);
      this.logger.info("credential.remove.success", { credentialId });
      return;
    } catch (error) {
      this.rethrowCommandError("remove", credentialId, undefined, error);
    }
  }

  private validateCredentialId(credentialId: string): void {
    if (!credentialId.trim()) {
      throw new CredentialStoreValidationError("Credential id is required");
    }
  }

  private readSecrets(
    secretsOrWriter:
      | Pick<WindowsSecretStore, "write" | "read" | "has" | "remove">
      | Pick<WindowsCredentialWriter, "write" | "read" | "remove">
      | undefined,
  ): Pick<WindowsSecretStore, "write" | "read" | "has" | "remove"> {
    if (secretsOrWriter && "has" in secretsOrWriter) {
      return secretsOrWriter;
    }

    return new WindowsSecretStore(
      this.serviceName,
      this.logger.child({ scope: "windows-secret-store" }),
      secretsOrWriter,
    );
  }

  private rethrowCommandError(
    action: string,
    credentialId: string,
    kind: StoredCredential["kind"] | undefined,
    error: unknown,
  ): never {
    if (error instanceof WindowsSecretNotFoundError) {
      this.logger.warn(`credential.${action}.missing`, { credentialId, ...(kind ? { kind } : {}) });
      throw new CredentialNotFoundError(credentialId);
    }
    if (error instanceof WindowsSecretAccessDeniedError) {
      this.logger.warn(`credential.${action}.denied`, { credentialId, ...(kind ? { kind } : {}) });
      throw new SystemSecureCredentialStoreDeniedError();
    }
    if (error instanceof WindowsSecretValidationError) {
      throw new CredentialStoreValidationError(error.message);
    }
    if (!(error instanceof WindowsSecretStoreError)) {
      throw error;
    }

    this.logger.error(`credential.${action}.failed`, error.message, {
      credentialId,
      ...(kind ? { kind } : {}),
    });
    throw new CredentialStoreCommandError(`Failed to ${action} credential ${credentialId}: ${error.message}`);
  }
}
