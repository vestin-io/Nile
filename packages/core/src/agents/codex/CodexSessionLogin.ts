import type { StoredCredential } from "../../services/credential/Types";
import { CodexCurrentCredentialReader } from "./current-state/CurrentCredentialReader";
import { spawnSync } from "node:child_process";

export class CodexSessionLogin {
  signIn(codexHome: string): void {
    const result = spawnSync("codex", ["login"], {
      stdio: "inherit",
      env: {
        ...process.env,
        CODEX_HOME: codexHome,
      },
    });

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`codex login failed with exit code ${result.status ?? "unknown"}`);
    }
  }

  signInAndRead(codexHome: string): StoredCredential {
    this.signIn(codexHome);
    return CodexCurrentCredentialReader.open({ codexHome }).read();
  }
}
