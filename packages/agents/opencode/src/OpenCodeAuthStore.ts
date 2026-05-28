import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type JsonObject = Record<string, unknown>;

export type OpenCodeOauthCredential = {
  type: "oauth";
  access: string;
  refresh: string;
  expires: number;
  accountId?: string;
};

export class OpenCodeAuthStore {
  readonly authPath: string;

  constructor(opencodeDataHome: string) {
    this.authPath = join(opencodeDataHome, "auth.json");
  }

  snapshot(): string | null {
    try {
      return readFileSync(this.authPath, "utf8");
    } catch {
      return null;
    }
  }

  readParsedStore(): JsonObject {
    const snapshot = this.snapshot();
    if (!snapshot?.trim()) {
      return {};
    }

    const parsed = JSON.parse(snapshot) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("OpenCode auth.json must contain a JSON object");
    }
    return parsed as JsonObject;
  }

  readOauthCredential(providerId: string): OpenCodeOauthCredential | null {
    const store = this.readParsedStore();
    const provider = asObject(store[providerId]);
    if (!provider) {
      return null;
    }
    if (provider.type !== "oauth") {
      return null;
    }

    const access = readString(provider.access);
    const refresh = readString(provider.refresh);
    const expires = typeof provider.expires === "number" && Number.isFinite(provider.expires)
      ? provider.expires
      : null;
    if (!access || !refresh || expires === null) {
      throw new Error(`OpenCode auth provider ${providerId} is missing oauth access, refresh, or expires`);
    }

    return {
      type: "oauth",
      access,
      refresh,
      expires,
      ...(readString(provider.accountId) ? { accountId: readString(provider.accountId)! } : {}),
    };
  }

  writeOauthCredential(providerId: string, credential: OpenCodeOauthCredential): void {
    const store = this.readParsedStore();
    store[providerId] = credential;
    this.writeStore(store);
  }

  restore(snapshot: string | null): void {
    if (snapshot === null) {
      rmSync(this.authPath, { force: true });
      return;
    }

    mkdirSync(dirname(this.authPath), { recursive: true });
    writeFileSync(this.authPath, snapshot, "utf8");
  }

  private writeStore(store: JsonObject): void {
    mkdirSync(dirname(this.authPath), { recursive: true });
    writeFileSync(this.authPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }
}

function asObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
