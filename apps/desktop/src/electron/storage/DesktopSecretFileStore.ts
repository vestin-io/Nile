import { safeStorage } from "electron";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type PersistedSecrets = {
  version: 1;
  encrypted: boolean;
  entries: Record<string, string>;
};

export class DesktopSecretFileStore {
  constructor(private readonly filePath: string) {}

  read(key: string): string | null {
    const store = this.readStore();
    const value = store.entries[key];
    if (typeof value !== "string") {
      return null;
    }

    return store.encrypted
      ? safeStorage.decryptString(Buffer.from(value, "base64"))
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
    if (!existsSync(this.filePath)) {
      return this.createEmptyStore();
    }

    const raw = readFileSync(this.filePath, "utf8");
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
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    try {
      renameSync(tempPath, this.filePath);
    } catch (error) {
      try {
        unlinkSync(this.filePath);
      } catch {}
      renameSync(tempPath, this.filePath);
      if (error) {
        return;
      }
    }
  }

  private createEmptyStore(): PersistedSecrets {
    return {
      version: 1,
      encrypted: safeStorage.isEncryptionAvailable(),
      entries: {},
    };
  }

  private encodeValue(value: string, encrypted: boolean): string {
    if (!encrypted) {
      return value;
    }

    return safeStorage.encryptString(value).toString("base64");
  }

  private normalizeEntries(entries: PersistedSecrets["entries"] | undefined): Record<string, string> {
    if (!entries || typeof entries !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(entries).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  }
}
