import { homedir } from "node:os";
import { join } from "node:path";

import type { ClaudeSessionCredential, StoredCredential } from "../../../services/credential/Types";
import { ClaudeCredentialStore } from "../Store";
import { LiveSetupReader } from "./Reader";
import { ClaudeSettingsStore } from "../SettingsStore";

export class CurrentCredentialReader {
  static open(options?: { claudeHome?: string }): CurrentCredentialReader {
    const claudeHome = options?.claudeHome ?? join(homedir(), ".claude");
    return new CurrentCredentialReader(
      new LiveSetupReader(
        new ClaudeSettingsStore(claudeHome),
        new ClaudeCredentialStore(claudeHome),
      ),
    );
  }

  constructor(private readonly reader: LiveSetupReader) {}

  read(): StoredCredential {
    const result = this.reader.read();
    if (result.kind !== "resolved") {
      throw new Error(result.issues.join("; ") || "No supported credential found in current Claude state");
    }
    return result.value.credential;
  }

  readSession(): ClaudeSessionCredential {
    const credential = this.read();
    if (credential.kind !== "claude_session") {
      throw new Error("No Claude session found in current Claude state");
    }
    return credential;
  }
}
