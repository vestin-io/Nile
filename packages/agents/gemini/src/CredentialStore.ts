import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

import { readOptionalTextFile } from "@nile/core/services/OptionalTextFile";
import { writePrivateTextFile } from "@nile/core/services/PrivateTextFile";
import { GeminiCredentialDocumentCodec } from "./Document";
import type { GeminiLocalSessionCredential } from "./types";

export class GeminiCredentialStore {
  readonly credentialsPath: string;

  constructor(
    geminiHome: string,
    private readonly codec: GeminiCredentialDocumentCodec = new GeminiCredentialDocumentCodec(),
  ) {
    this.credentialsPath = join(geminiHome, "oauth_creds.json");
  }

  snapshot(): string | null {
    if (!existsSync(this.credentialsPath)) {
      return null;
    }
    return readOptionalTextFile(this.credentialsPath, "Gemini oauth_creds.json");
  }

  readCredential(): GeminiLocalSessionCredential | null {
    const raw = this.snapshot();
    if (!raw?.trim()) {
      return null;
    }
    return this.codec.readCredential(raw);
  }

  apply(credential: GeminiLocalSessionCredential): void {
    writePrivateTextFile(this.credentialsPath, this.codec.serialize(credential));
  }

  restore(snapshot: string | null): void {
    if (snapshot === null) {
      rmSync(this.credentialsPath, { force: true });
      return;
    }

    writePrivateTextFile(this.credentialsPath, snapshot);
  }
}
