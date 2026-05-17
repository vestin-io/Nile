import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type JsonObject = Record<string, unknown>;

export type OpenClawAuthProfileCredential =
  | {
      type: "api_key";
      provider: string;
      key?: string;
      email?: string;
      metadata?: Record<string, string>;
    }
  | {
      type: "token";
      provider: string;
      token: string;
      expires?: number;
      email?: string;
    }
  | {
      type: "oauth";
      provider: string;
      access: string;
      refresh: string;
      expires: number;
      accountId?: string;
      email?: string;
    };

export type OpenClawAuthProfileStoreDocument = {
  version: number;
  profiles: Record<string, OpenClawAuthProfileCredential>;
  order?: Record<string, string[]>;
  lastGood?: Record<string, string>;
  usageStats?: Record<string, unknown>;
};

export class OpenClawAuthProfileStore {
  readonly filePath: string;

  constructor(openclawHome: string) {
    this.filePath = join(openclawHome, "agents", "main", "agent", "auth-profiles.json");
  }

  snapshot(): string | null {
    try {
      return readFileSync(this.filePath, "utf8");
    } catch {
      return null;
    }
  }

  readParsedStore(): OpenClawAuthProfileStoreDocument {
    const snapshot = this.snapshot();
    if (!snapshot?.trim()) {
      return { version: 1, profiles: {} };
    }

    const parsed = JSON.parse(snapshot) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("OpenClaw auth-profiles.json must contain a JSON object");
    }

    const record = parsed as JsonObject;
    const profiles = asObject(record.profiles);
    if (!profiles) {
      throw new Error("OpenClaw auth-profiles.json must contain a profiles object");
    }

    const version = typeof record.version === "number" ? record.version : 1;
    return {
      version,
      profiles: profiles as Record<string, OpenClawAuthProfileCredential>,
      ...(asObject(record.order) ? { order: asObject(record.order) as Record<string, string[]> } : {}),
      ...(asObject(record.lastGood) ? { lastGood: asObject(record.lastGood) as Record<string, string> } : {}),
      ...(asObject(record.usageStats) ? { usageStats: asObject(record.usageStats) as Record<string, unknown> } : {}),
    };
  }

  restore(snapshot: string | null): void {
    if (snapshot === null) {
      rmSync(this.filePath, { force: true });
      return;
    }

    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, snapshot, "utf8");
  }

  writeStore(store: OpenClawAuthProfileStoreDocument): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }
}

function asObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}
