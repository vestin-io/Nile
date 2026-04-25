import { spawnSync } from "node:child_process";
import { dirname } from "node:path";

import type { ClaudeSessionCredential } from "../../services/credential/Types";
import { CurrentCredentialReader } from "./current-state/CredentialReader";

export class ClaudeSessionLogin {
  signIn(claudeHome: string): void {
    const result = spawnSync("claude", ["login"], {
      stdio: "inherit",
      env: {
        ...process.env,
        HOME: dirname(claudeHome),
      },
    });

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`claude login failed with exit code ${result.status ?? "unknown"}`);
    }
  }

  signInAndRead(claudeHome: string): ClaudeSessionCredential {
    this.signIn(claudeHome);
    return CurrentCredentialReader.open({ claudeHome }).readSession();
  }
}
