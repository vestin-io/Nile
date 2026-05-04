import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { readOptionalTextFile } from "../../services/OptionalTextFile";

type CredentialDocument = {
  claudeAiOauth?: Record<string, unknown>;
  [key: string]: unknown;
};

export class ClaudeCredentialStore {
  readonly credentialsPath: string;

  constructor(claudeHome: string) {
    this.credentialsPath = join(claudeHome, ".credentials.json");
  }

  snapshot(): string | null {
    return readOptionalTextFile(this.credentialsPath, "Claude .credentials.json");
  }

  readOauth(): Record<string, unknown> | null {
    const document = this.readDocument();
    const oauth = document.claudeAiOauth;
    if (!oauth || typeof oauth !== "object" || Array.isArray(oauth)) {
      return null;
    }
    return oauth;
  }

  private readDocument(): CredentialDocument {
    const raw = this.snapshot();
    if (!raw?.trim()) {
      return {};
    }
    return this.parse(raw);
  }

  applyOauth(oauth: Record<string, unknown>): void {
    const document = this.readDocument();
    document.claudeAiOauth = oauth;
    this.writeDocument(document);
  }

  restore(snapshot: string | null): void {
    if (snapshot === null) {
      rmSync(this.credentialsPath, { force: true });
      return;
    }

    this.ensureDirectory();
    this.writePrivateFile(snapshot);
  }

  private writeDocument(document: CredentialDocument): void {
    this.ensureDirectory();
    this.writePrivateFile(`${JSON.stringify(document, null, 2)}\n`);
  }

  private parse(raw: string): CredentialDocument {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Claude .credentials.json must contain a JSON object");
    }
    return parsed as CredentialDocument;
  }

  private ensureDirectory(): void {
    mkdirSync(dirname(this.credentialsPath), { recursive: true, mode: 0o700 });
  }

  private writePrivateFile(content: string): void {
    writeFileSync(this.credentialsPath, content, { encoding: "utf8", mode: 0o600 });
    chmodSync(this.credentialsPath, 0o600);
  }
}
