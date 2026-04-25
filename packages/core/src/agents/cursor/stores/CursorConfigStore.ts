import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { writePrivateTextFile } from "../../../services/PrivateTextFile";
import type { CursorConfigState, CursorAuthInfo } from "../types";

const DEFAULT_BACKEND_URL = "https://api2.cursor.sh";

type CursorConfigDocument = {
  serverConfigCache?: {
    backendUrl?: unknown;
    authCacheKey?: unknown;
    [key: string]: unknown;
  };
  authInfo?: {
    email?: unknown;
    displayName?: unknown;
    userId?: unknown;
    authId?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export class CursorConfigStore {
  readonly configPath: string;

  constructor(cursorHome: string) {
    this.configPath = join(cursorHome, "cli-config.json");
  }

  snapshot(): string | null {
    try {
      return readFileSync(this.configPath, "utf8");
    } catch {
      return null;
    }
  }

  readState(): CursorConfigState | null {
    const snapshot = this.snapshot();
    if (snapshot === null || !snapshot.trim()) {
      return null;
    }

    const document = this.parse(snapshot);
    const backendUrl = this.readString(document.serverConfigCache, "backendUrl") ?? DEFAULT_BACKEND_URL;
    const authCacheKey = this.readString(document.serverConfigCache, "authCacheKey") ?? undefined;
    const authInfo = this.readAuthInfo(document.authInfo);

    return {
      backendUrl,
      authCacheKey,
      authInfo,
    };
  }

  applySession(authInfo: CursorAuthInfo, authCacheKey: string, backendUrl?: string): void {
    const document = this.readDocument();
    document.serverConfigCache = document.serverConfigCache ?? {};
    document.serverConfigCache.backendUrl = backendUrl ?? this.readString(document.serverConfigCache, "backendUrl") ?? DEFAULT_BACKEND_URL;
    document.serverConfigCache.authCacheKey = authCacheKey;
    document.authInfo = {
      ...(document.authInfo ?? {}),
      ...(authInfo.email ? { email: authInfo.email } : {}),
      ...(authInfo.displayName ? { displayName: authInfo.displayName } : {}),
      ...(typeof authInfo.userId === "number" ? { userId: authInfo.userId } : {}),
      ...(authInfo.authId ? { authId: authInfo.authId } : {}),
    };
    this.writeDocument(document);
  }

  applyApiKey(backendUrl?: string): void {
    const document = this.readDocument();
    document.serverConfigCache = document.serverConfigCache ?? {};
    document.serverConfigCache.backendUrl = backendUrl ?? this.readString(document.serverConfigCache, "backendUrl") ?? DEFAULT_BACKEND_URL;
    delete document.serverConfigCache.authCacheKey;
    delete document.authInfo;
    this.writeDocument(document);
  }

  restore(snapshot: string | null): void {
    if (snapshot === null) {
      rmSync(this.configPath, { force: true });
      return;
    }

    writePrivateTextFile(this.configPath, snapshot);
  }

  private readDocument(): CursorConfigDocument {
    const snapshot = this.snapshot();
    if (snapshot === null || !snapshot.trim()) {
      return {};
    }
    return this.parse(snapshot);
  }

  private writeDocument(document: CursorConfigDocument): void {
    writePrivateTextFile(this.configPath, `${JSON.stringify(document, null, 2)}\n`);
  }

  private parse(snapshot: string): CursorConfigDocument {
    const parsed = JSON.parse(snapshot) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Cursor cli-config.json must contain a JSON object");
    }
    return parsed as CursorConfigDocument;
  }

  private readAuthInfo(value: CursorConfigDocument["authInfo"]): CursorAuthInfo | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }

    const authInfo: CursorAuthInfo = {};
    const email = this.readString(value, "email");
    const displayName = this.readString(value, "displayName");
    const authId = this.readString(value, "authId");
    const userId = this.readNumber(value, "userId");

    if (email) {
      authInfo.email = email;
    }
    if (displayName) {
      authInfo.displayName = displayName;
    }
    if (authId) {
      authInfo.authId = authId;
    }
    if (typeof userId === "number") {
      authInfo.userId = userId;
    }

    return Object.keys(authInfo).length > 0 ? authInfo : undefined;
  }

  private readString(value: Record<string, unknown> | undefined, key: string): string | null {
    const candidate = value?.[key];
    return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
  }

  private readNumber(value: Record<string, unknown> | undefined, key: string): number | undefined {
    const candidate = value?.[key];
    return typeof candidate === "number" && !Number.isNaN(candidate) ? candidate : undefined;
  }
}
