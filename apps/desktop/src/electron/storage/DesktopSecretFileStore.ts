import { safeStorage } from "electron";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type PersistedSecrets = {
  version: 1;
  encrypted: boolean;
  entries: Record<string, string>;
};

type DesktopSafeStorage = Pick<typeof safeStorage, "decryptString" | "encryptString" | "isEncryptionAvailable">;
type DesktopSecretFileStoreDependencies = {
  existsSync: typeof existsSync;
  mkdirSync: typeof mkdirSync;
  readFileSync: typeof readFileSync;
  renameSync: typeof renameSync;
  unlinkSync: typeof unlinkSync;
  writeFileSync: typeof writeFileSync;
  safeStorage: DesktopSafeStorage;
};

export class DesktopSecretFileStore {
  private readonly dependencies: DesktopSecretFileStoreDependencies;

  constructor(filePath: string, dependencies?: Partial<DesktopSecretFileStoreDependencies>) {
    this.filePath = filePath;
    this.dependencies = {
      existsSync,
      mkdirSync,
      readFileSync,
      renameSync,
      unlinkSync,
      writeFileSync,
      safeStorage,
      ...dependencies,
    };
  }

  private readonly filePath: string;

  read(key: string): string | null {
    const store = this.readStore();
    const value = store.entries[key];
    if (typeof value !== "string") {
      return null;
    }

    return store.encrypted
      ? this.dependencies.safeStorage.decryptString(Buffer.from(value, "base64"))
      : value;
  }

  write(key: string, value: string): void {
    const store = this.readStore();
    store.entries[key] = this.encodeValue(value, store.encrypted);
    this.writeStore(store);
  }

  remove(key: string): boolean {
    const store = this.readStore();
    if (!(key in store.entries)) {
      return false;
    }

    delete store.entries[key];
    this.writeStore(store);
    return true;
  }

  has(key: string): boolean {
    const store = this.readStore();
    return typeof store.entries[key] === "string";
  }

  private readStore(): PersistedSecrets {
    if (!this.dependencies.existsSync(this.filePath)) {
      return this.createEmptyStore();
    }

    const raw = this.dependencies.readFileSync(this.filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<PersistedSecrets>;
    const encrypted = parsed.encrypted === true;
    const entries = this.normalizeEntries(parsed.entries);
    return {
      version: 1,
      encrypted,
      entries,
    };
  }

  private writeStore(store: PersistedSecrets): void {
    this.dependencies.mkdirSync(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    const backupPath = `${this.filePath}.bak`;
    this.dependencies.writeFileSync(tempPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    try {
      if (!this.dependencies.existsSync(this.filePath)) {
        this.dependencies.renameSync(tempPath, this.filePath);
        return;
      }

      this.removeIfPresent(backupPath);
      this.dependencies.renameSync(this.filePath, backupPath);
      try {
        this.dependencies.renameSync(tempPath, this.filePath);
      } catch (error) {
        this.restoreBackupFile(backupPath);
        throw error;
      }
      this.removeIfPresent(backupPath);
    } finally {
      this.removeIfPresent(tempPath);
    }
  }

  private createEmptyStore(): PersistedSecrets {
    return {
      version: 1,
      encrypted: this.dependencies.safeStorage.isEncryptionAvailable(),
      entries: {},
    };
  }

  private encodeValue(value: string, encrypted: boolean): string {
    if (!encrypted) {
      return value;
    }

    return this.dependencies.safeStorage.encryptString(value).toString("base64");
  }

  private normalizeEntries(entries: PersistedSecrets["entries"] | undefined): Record<string, string> {
    if (!entries || typeof entries !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(entries).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  }

  private removeIfPresent(path: string): void {
    try {
      this.dependencies.unlinkSync(path);
    } catch {}
  }

  private restoreBackupFile(backupPath: string): void {
    if (!this.dependencies.existsSync(backupPath)) {
      return;
    }
    this.removeIfPresent(this.filePath);
    this.dependencies.renameSync(backupPath, this.filePath);
  }
}
