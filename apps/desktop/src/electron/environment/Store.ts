import {
  GenericPasswordWriter,
  CredentialStoreCommandError,
  CredentialStoreValidationError,
} from "@nile/core/services/credential";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DesktopSecretFileStore } from "../storage/DesktopSecretFileStore";

type GenericPasswordReadResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  errorMessage?: string;
};

export class DesktopEnvironmentStore {
  private readonly cache = new Map<string, string | null>();
  private readonly fileStore: DesktopSecretFileStore | null;

  constructor(
    databasePath?: string,
    private readonly serviceName: string = "nile.switcher.environment",
    private readonly writer: Pick<GenericPasswordWriter, "write" | "read" | "remove"> = new GenericPasswordWriter(
      undefined,
      () => readDesktopKeychainHelperPath(),
    ),
  ) {
    this.fileStore = process.platform === "darwin" || !databasePath
      ? null
      : new DesktopSecretFileStore(readDesktopEnvironmentStorePath(databasePath));
  }

  read(envKey: string): string | null {
    const normalizedEnvKey = this.normalizeEnvKey(envKey);
    if (this.cache.has(normalizedEnvKey)) {
      return this.cache.get(normalizedEnvKey) ?? null;
    }
    if (this.fileStore) {
      const value = this.fileStore.read(normalizedEnvKey);
      this.cache.set(normalizedEnvKey, value);
      return value;
    }

    const result = this.writer.read({
      account: normalizedEnvKey,
      service: this.serviceName,
      includeSecret: true,
    });
    if (result.exitCode === 0) {
      const value = result.stdout.trim();
      this.cache.set(normalizedEnvKey, value || null);
      return value || null;
    }
    if (this.isMissing(result)) {
      this.cache.set(normalizedEnvKey, null);
      return null;
    }
    throw new CredentialStoreCommandError(this.buildCommandError("read", normalizedEnvKey, result));
  }

  write(envKey: string, value: string): void {
    const normalizedEnvKey = this.normalizeEnvKey(envKey);
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      throw new CredentialStoreValidationError("Environment value is required");
    }
    if (this.fileStore) {
      this.fileStore.write(normalizedEnvKey, normalizedValue);
      this.cache.set(normalizedEnvKey, normalizedValue);
      return;
    }

    const result = this.writer.write({
      account: normalizedEnvKey,
      service: this.serviceName,
      secret: normalizedValue,
      update: true,
    });
    if (result.exitCode !== 0) {
      throw new CredentialStoreCommandError(this.buildCommandError("write", normalizedEnvKey, result));
    }
    this.cache.set(normalizedEnvKey, normalizedValue);
  }

  remove(envKey: string): void {
    const normalizedEnvKey = this.normalizeEnvKey(envKey);
    if (this.fileStore) {
      this.fileStore.remove(normalizedEnvKey);
      this.cache.delete(normalizedEnvKey);
      return;
    }
    const result = this.writer.remove({
      account: normalizedEnvKey,
      service: this.serviceName,
    });
    if (result.exitCode !== 0 && !this.isMissing(result)) {
      throw new CredentialStoreCommandError(this.buildCommandError("remove", normalizedEnvKey, result));
    }
    this.cache.delete(normalizedEnvKey);
  }

  private normalizeEnvKey(envKey: string): string {
    const normalizedEnvKey = envKey.trim();
    if (!/^[A-Z_][A-Z0-9_]*$/.test(normalizedEnvKey)) {
      throw new CredentialStoreValidationError(`Environment variable name is invalid: ${envKey}`);
    }
    return normalizedEnvKey;
  }

  private isMissing(result: GenericPasswordReadResult): boolean {
    return /could not be found|item not found|errsecitemnotfound/i.test(result.stderr);
  }

  private buildCommandError(action: string, envKey: string, result: GenericPasswordReadResult): string {
    const detail = result.stderr.trim() || result.errorMessage?.trim() || `security exited with code ${result.exitCode}`;
    return `Failed to ${action} environment value ${envKey}: ${detail}`;
  }
}

function readDesktopKeychainHelperPath(): string {
  const currentDir = resolveCurrentDir();
  for (const helperPath of readDesktopHelperPathCandidates(currentDir)) {
    if (existsSync(helperPath)) {
      return helperPath;
    }
  }

  throw new Error(
    "Nile keychain helper was not found. Run npm run build:core before using keychain-backed credential storage.",
  );
}

function resolveCurrentDir(): string {
  if (typeof __filename === "string") {
    return dirname(__filename);
  }

  const moduleUrl = import.meta?.url;
  if (typeof moduleUrl === "string") {
    return dirname(fileURLToPath(moduleUrl));
  }

  throw new Error("Nile desktop environment store helper path could not be resolved for this runtime.");
}

export function readDesktopHelperPathCandidates(currentDir: string): string[] {
  const workspaceCoreHelperPath = join(
    currentDir,
    "..",
    "..",
    "..",
    "..",
    "..",
    "packages",
    "core",
    "dist",
    "services",
    "credential",
    "KeychainGenericPasswordHelper",
  );
  const colocatedHelperPath = join(currentDir, "KeychainGenericPasswordHelper");
  const distHelperPath = join(currentDir, "..", "..", "..", "dist", "services", "credential", "KeychainGenericPasswordHelper");

  return [...new Set([
    workspaceCoreHelperPath,
    readUnpackedAsarPath(colocatedHelperPath),
    colocatedHelperPath,
    readUnpackedAsarPath(distHelperPath),
    distHelperPath,
  ])];
}

function readUnpackedAsarPath(path: string): string {
  return path.includes("app.asar") ? path.replaceAll("app.asar", "app.asar.unpacked") : path;
}

function readDesktopEnvironmentStorePath(databasePath: string): string {
  const databaseDir = dirname(databasePath);
  return join(databaseDir, "desktop-environment.json");
}
