import { randomUUID } from "node:crypto";
import { NileLogger } from "../../services/NileLogger";
import { WINDOWS_CREDENTIAL_BLOB_LIMIT_BYTES, WindowsCredentialWriter } from "./WindowsCredentialWriter";

const WINDOWS_SECRET_CHUNK_PREFIX = "__nile_windows_chunks_v1__:";

export class WindowsSecretStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WindowsSecretStoreError";
  }
}

export class WindowsSecretNotFoundError extends WindowsSecretStoreError {
  constructor(account: string) {
    super(`Windows secret was not found for ${account}`);
    this.name = "WindowsSecretNotFoundError";
  }
}

export class WindowsSecretAccessDeniedError extends WindowsSecretStoreError {
  constructor(account: string) {
    super(`Windows secret access was denied for ${account}`);
    this.name = "WindowsSecretAccessDeniedError";
  }
}

export class WindowsSecretValidationError extends WindowsSecretStoreError {
  constructor(message: string) {
    super(message);
    this.name = "WindowsSecretValidationError";
  }
}

type WindowsCredentialResultLike = {
  exitCode: number;
  stderr: string;
  errorMessage?: string;
  stdout?: string;
};

type StoredSecretDescriptor =
  | {
    kind: "direct";
    secret: string;
  }
  | {
    kind: "chunked";
    chunkAccounts: string[];
  };

type StoredSecretManifest = {
  chunkCount?: unknown;
  chunkAccounts?: unknown;
};

export class WindowsSecretStore {
  constructor(
    private readonly serviceName: string,
    private readonly logger: NileLogger = NileLogger.silent().child({ module: "windows-secret-store" }),
    private readonly writer: Pick<WindowsCredentialWriter, "write" | "read" | "remove"> = new WindowsCredentialWriter(),
  ) {}

  write(account: string, secret: string): void {
    this.validateAccount(account);
    const previousDescriptor = this.readStoredSecretDescriptorIfPresent(account);
    const nextDescriptor = this.writeSecret(account, secret);
    if (!previousDescriptor) {
      return;
    }

    this.removeStaleChunks(previousDescriptor, nextDescriptor);
  }

  read(account: string): string {
    this.validateAccount(account);
    const descriptor = this.readStoredSecretDescriptor(account);
    if (descriptor.kind === "direct") {
      return descriptor.secret;
    }

    return descriptor.chunkAccounts
      .map((chunkAccount) => this.readEntry(chunkAccount, true))
      .join("");
  }

  has(account: string): boolean {
    this.validateAccount(account);
    const result = this.writer.read({
      account,
      service: this.serviceName,
      includeSecret: false,
    });
    if (result.exitCode === 0) {
      return true;
    }
    if (this.isMissingError(result)) {
      return false;
    }
    if (this.isAccessDeniedError(result)) {
      throw new WindowsSecretAccessDeniedError(account);
    }

    throw new WindowsSecretStoreError(this.buildCommandError("check", account, result));
  }

  remove(account: string): void {
    this.validateAccount(account);
    const descriptor = this.readStoredSecretDescriptor(account);
    if (descriptor.kind === "chunked") {
      for (const chunkAccount of descriptor.chunkAccounts) {
        this.removeEntryIfPresent(chunkAccount);
      }
    }
    this.removeEntry(account);
  }

  private validateAccount(account: string): void {
    if (!account.trim()) {
      throw new WindowsSecretValidationError("Windows secret account is required");
    }
  }

  private readStoredSecretDescriptorIfPresent(account: string): StoredSecretDescriptor | null {
    try {
      return this.readStoredSecretDescriptor(account);
    } catch (error) {
      if (error instanceof WindowsSecretNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  private readStoredSecretDescriptor(account: string): StoredSecretDescriptor {
    const baseSecret = this.readEntry(account, true);
    if (!baseSecret.startsWith(WINDOWS_SECRET_CHUNK_PREFIX)) {
      return {
        kind: "direct",
        secret: baseSecret,
      };
    }

    const manifest = this.readStoredSecretManifest(baseSecret);
    const chunkAccounts = this.readChunkAccounts(account, manifest);
    if (chunkAccounts.length === 0) {
      throw new WindowsSecretValidationError("Stored Windows secret manifest is invalid");
    }

    return {
      kind: "chunked",
      chunkAccounts,
    };
  }

  private readStoredSecretManifest(baseSecret: string): StoredSecretManifest {
    try {
      return JSON.parse(baseSecret.slice(WINDOWS_SECRET_CHUNK_PREFIX.length)) as StoredSecretManifest;
    } catch {
      throw new WindowsSecretValidationError("Stored Windows secret manifest is invalid JSON");
    }
  }

  private writeSecret(account: string, secret: string): StoredSecretDescriptor {
    const chunks = this.splitSecretChunks(secret);
    if (chunks.length === 1) {
      this.writeEntry(account, secret);
      return {
        kind: "direct",
        secret,
      };
    }

    const writeId = randomUUID();
    const chunkAccounts = chunks.map((_, index) => this.readChunkAccountName(account, writeId, index));
    const manifest = `${WINDOWS_SECRET_CHUNK_PREFIX}${JSON.stringify({ chunkAccounts })}`;
    const writtenChunkAccounts: string[] = [];
    try {
      for (let index = 0; index < chunks.length; index += 1) {
        this.writeEntry(chunkAccounts[index], chunks[index]);
        writtenChunkAccounts.push(chunkAccounts[index]);
      }
      this.writeEntry(account, manifest);
      return {
        kind: "chunked",
        chunkAccounts,
      };
    } catch (error) {
      for (const chunkAccount of writtenChunkAccounts.reverse()) {
        this.removeEntryIfPresent(chunkAccount);
      }
      throw error;
    }
  }

  private removeStaleChunks(
    previousDescriptor: StoredSecretDescriptor,
    nextDescriptor: StoredSecretDescriptor,
  ): void {
    if (previousDescriptor.kind !== "chunked") {
      return;
    }

    const preservedAccounts = new Set(
      nextDescriptor.kind === "chunked" ? nextDescriptor.chunkAccounts : [],
    );
    for (const chunkAccount of previousDescriptor.chunkAccounts) {
      if (preservedAccounts.has(chunkAccount)) {
        continue;
      }

      this.removeEntryIfPresent(chunkAccount);
    }
  }

  private splitSecretChunks(secret: string): string[] {
    const chunks: string[] = [];
    let chunkStart = 0;
    let chunkBytes = 0;
    let index = 0;

    while (index < secret.length) {
      const codeUnit = secret.charCodeAt(index);
      const charLength = isHighSurrogate(codeUnit) && index + 1 < secret.length ? 2 : 1;
      const charBytes = charLength * 2;
      if (chunkBytes > 0 && chunkBytes + charBytes > WINDOWS_CREDENTIAL_BLOB_LIMIT_BYTES) {
        chunks.push(secret.slice(chunkStart, index));
        chunkStart = index;
        chunkBytes = 0;
      }
      chunkBytes += charBytes;
      index += charLength;
    }

    chunks.push(secret.slice(chunkStart));
    return chunks;
  }

  private readChunkAccounts(account: string, manifest: StoredSecretManifest): string[] {
    if (Array.isArray(manifest.chunkAccounts)) {
      const chunkAccounts = manifest.chunkAccounts
        .filter((chunkAccount): chunkAccount is string => typeof chunkAccount === "string" && chunkAccount.trim().length > 0);
      return chunkAccounts;
    }

    const normalizedChunkCount = Number(manifest.chunkCount);
    if (!Number.isInteger(normalizedChunkCount) || normalizedChunkCount < 1) {
      return [];
    }
    return Array.from({ length: normalizedChunkCount }, (_, index) => this.readLegacyChunkAccountName(account, index));
  }

  private readLegacyChunkAccountName(account: string, index: number): string {
    return `${account}::chunk:${index}`;
  }

  private readChunkAccountName(account: string, writeId: string, index: number): string {
    return `${account}::chunk:${writeId}:${index}`;
  }

  private readEntry(account: string, includeSecret: boolean): string {
    const result = this.writer.read({
      account,
      service: this.serviceName,
      includeSecret,
    });
    if (result.exitCode === 0) {
      return result.stdout;
    }
    if (this.isMissingError(result)) {
      throw new WindowsSecretNotFoundError(account);
    }
    if (this.isAccessDeniedError(result)) {
      throw new WindowsSecretAccessDeniedError(account);
    }

    throw new WindowsSecretStoreError(this.buildCommandError("read", account, result));
  }

  private writeEntry(account: string, secret: string): void {
    const result = this.writer.write({
      account,
      service: this.serviceName,
      secret,
    });
    if (result.exitCode === 0) {
      return;
    }
    if (this.isAccessDeniedError(result)) {
      throw new WindowsSecretAccessDeniedError(account);
    }

    throw new WindowsSecretStoreError(this.buildCommandError("write", account, result));
  }

  private removeEntry(account: string): void {
    const result = this.writer.remove({
      account,
      service: this.serviceName,
    });
    if (result.exitCode === 0) {
      return;
    }
    if (this.isMissingError(result)) {
      throw new WindowsSecretNotFoundError(account);
    }
    if (this.isAccessDeniedError(result)) {
      throw new WindowsSecretAccessDeniedError(account);
    }

    throw new WindowsSecretStoreError(this.buildCommandError("remove", account, result));
  }

  private removeEntryIfPresent(account: string): void {
    try {
      this.removeEntry(account);
    } catch (error) {
      if (error instanceof WindowsSecretNotFoundError) {
        return;
      }

      this.logger.warn("windows_secret.remove.cleanup_failed", {
        account,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private isMissingError(result: WindowsCredentialResultLike): boolean {
    const detail = `${result.stderr}\n${result.errorMessage ?? ""}`;
    return /win32 1168|element not found|not found/i.test(detail);
  }

  private isAccessDeniedError(result: WindowsCredentialResultLike): boolean {
    const detail = `${result.stderr}\n${result.errorMessage ?? ""}`;
    return /win32 5|access is denied/i.test(detail);
  }

  private buildCommandError(action: string, account: string, result: WindowsCredentialResultLike): string {
    const detail = result.stderr.trim() || result.errorMessage?.trim() || "powershell credential operation failed";
    return `Failed to ${action} Windows secret ${account}: ${detail}`;
  }
}

function isHighSurrogate(codeUnit: number): boolean {
  return codeUnit >= 0xd800 && codeUnit <= 0xdbff;
}
