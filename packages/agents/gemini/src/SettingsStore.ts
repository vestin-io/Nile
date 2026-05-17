import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

import { readOptionalTextFile } from "@nile/core/services/OptionalTextFile";
import { writePrivateTextFile } from "@nile/core/services/PrivateTextFile";
import { GEMINI_AUTH_TYPE_OAUTH_PERSONAL } from "./types";

type SettingsDocument = Record<string, unknown>;

export class GeminiSettingsStore {
  readonly settingsPath: string;

  constructor(geminiHome: string) {
    this.settingsPath = join(geminiHome, "settings.json");
  }

  snapshot(): string | null {
    if (!existsSync(this.settingsPath)) {
      return null;
    }
    return readOptionalTextFile(this.settingsPath, "Gemini settings.json");
  }

  readSelectedAuthType(): string | null {
    const document = this.readDocument();
    const security = this.readObject(document.security);
    const auth = this.readObject(security?.auth);
    return typeof auth?.selectedType === "string" && auth.selectedType.trim()
      ? auth.selectedType
      : null;
  }

  applySelectedAuthType(selectedType: string): void {
    const document = this.readDocument();
    const security = this.readObject(document.security) ?? {};
    const auth = this.readObject(security.auth) ?? {};

    auth.selectedType = selectedType;
    security.auth = auth;
    document.security = security;

    this.writeDocument(document);
  }

  ensureOauthPersonal(): void {
    this.applySelectedAuthType(GEMINI_AUTH_TYPE_OAUTH_PERSONAL);
  }

  restore(snapshot: string | null): void {
    if (snapshot === null) {
      rmSync(this.settingsPath, { force: true });
      return;
    }

    writePrivateTextFile(this.settingsPath, snapshot);
  }

  private readDocument(): SettingsDocument {
    const raw = this.snapshot();
    if (!raw?.trim()) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Gemini settings.json must contain a JSON object");
    }
    return parsed as SettingsDocument;
  }

  private writeDocument(document: SettingsDocument): void {
    writePrivateTextFile(this.settingsPath, `${JSON.stringify(document, null, 2)}\n`);
  }

  private readObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }
}
