import { homedir } from "node:os";
import { join } from "node:path";

import type { StoredCredential } from "../../../services/credential/Types";
import { CodexAuthStore } from "../stores/CodexAuthStore";

export class CodexCurrentCredentialReader {
  static open(options?: { authPath?: string, codexHome?: string }): CodexCurrentCredentialReader {
    if (options?.authPath?.trim()) {
      return new CodexCurrentCredentialReader(
        new CodexAuthStore({ authPath: expandHomePath(options.authPath.trim()) }),
      );
    }

    const codexHome = options?.codexHome ?? join(homedir(), ".codex");
    return new CodexCurrentCredentialReader(new CodexAuthStore({ codexHome }));
  }

  constructor(private readonly authStore: CodexAuthStore) {}

  read(): StoredCredential {
    const credential = this.authStore.readCredential();
    if (!credential) {
      throw new Error(`No supported credential found in ${this.authStore.authPath}`);
    }
    return credential;
  }
}

function expandHomePath(input: string): string {
  if (input === "~") {
    return homedir();
  }

  if (input.startsWith("~/")) {
    return join(homedir(), input.slice(2));
  }

  return input;
}
