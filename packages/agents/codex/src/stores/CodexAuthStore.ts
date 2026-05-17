import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  isEnvKeyApiKeyCredential,
  type OpenAiSessionCredential,
  type StoredCredential,
} from "@nile/core/services/credential";
import { readOptionalTextFile } from "@nile/core/services/OptionalTextFile";

export class CodexAuthStore {
  readonly codexHome: string;
  readonly authPath: string;

  constructor(input: { authPath: string } | { codexHome: string }) {
    if ("authPath" in input) {
      this.authPath = input.authPath;
      this.codexHome = dirname(input.authPath);
      return;
    }

    this.codexHome = input.codexHome;
    this.authPath = join(input.codexHome, "auth.json");
  }

  snapshot(): string | null {
    if (!existsSync(this.authPath)) {
      return null;
    }
    return readOptionalTextFile(this.authPath, "Codex auth.json");
  }

  readCredential(): StoredCredential | null {
    const snapshot = this.snapshot();
    if (snapshot === null) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(snapshot);
    } catch {
      return null;
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    if (typeof record.OPENAI_API_KEY === "string" && record.OPENAI_API_KEY.trim()) {
      return {
        kind: "api_key",
        source: "direct",
        apiKey: record.OPENAI_API_KEY,
      };
    }

    const tokens = record.tokens;
    if (typeof tokens !== "object" || tokens === null || Array.isArray(tokens)) {
      return null;
    }

    const tokenRecord = tokens as Record<string, unknown>;
    if (
      typeof tokenRecord.id_token !== "string" ||
      !tokenRecord.id_token ||
      typeof tokenRecord.access_token !== "string" ||
      !tokenRecord.access_token ||
      typeof tokenRecord.refresh_token !== "string" ||
      !tokenRecord.refresh_token
    ) {
      return null;
    }

    const credential: OpenAiSessionCredential = {
      kind: "openai_session",
      idToken: tokenRecord.id_token,
      accessToken: tokenRecord.access_token,
      refreshToken: tokenRecord.refresh_token,
    };

    if (typeof tokenRecord.account_id === "string" && tokenRecord.account_id) {
      credential.accountId = tokenRecord.account_id;
    }
    if (typeof record.last_refresh === "string" && record.last_refresh) {
      credential.lastRefresh = record.last_refresh;
    }

    return credential;
  }

  restore(snapshot: string | null): void {
    this.ensureDirectory();
    if (snapshot === null) {
      this.writePrivateFile("{}\n");
      return;
    }
    this.writePrivateFile(snapshot);
  }

  apply(credential: StoredCredential): void {
    this.ensureDirectory();
    this.writePrivateFile(`${JSON.stringify(this.buildPayload(credential), null, 2)}\n`);
  }

  private buildPayload(credential: StoredCredential): Record<string, unknown> {
    if (credential.kind === "api_key") {
      if (isEnvKeyApiKeyCredential(credential)) {
        return {
          OPENAI_API_KEY: null,
        };
      }
      return {
        OPENAI_API_KEY: credential.apiKey,
      };
    }

    if (credential.kind !== "openai_session") {
      throw new Error("Codex auth store only supports api_key and openai_session credentials");
    }

    return this.buildOpenAiSessionPayload(credential);
  }

  private buildOpenAiSessionPayload(credential: OpenAiSessionCredential): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      OPENAI_API_KEY: null,
      tokens: {
        id_token: credential.idToken,
        access_token: credential.accessToken,
        refresh_token: credential.refreshToken,
      },
    };

    if (credential.accountId) {
      const tokens = payload.tokens as Record<string, unknown>;
      tokens.account_id = credential.accountId;
    }
    if (credential.lastRefresh) {
      payload.last_refresh = credential.lastRefresh;
    }

    return payload;
  }

  private ensureDirectory(): void {
    mkdirSync(this.codexHome, { recursive: true, mode: 0o700 });
  }

  private writePrivateFile(content: string): void {
    writeFileSync(this.authPath, content, { encoding: "utf8", mode: 0o600 });
    chmodSync(this.authPath, 0o600);
  }
}
