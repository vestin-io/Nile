import { spawnSync } from "node:child_process";

import { EnvironmentSource } from "../../services/EnvironmentSource";
import type { StoredCredential } from "../../services/credential/Types";
import { CodexCurrentCredentialReader } from "./current-state/CurrentCredentialReader";

type SpawnResult = {
  error?: Error;
  status: number | null;
};

type SpawnFn = (
  command: string,
  args: string[],
  options: {
    stdio: "inherit";
    env: NodeJS.ProcessEnv;
  },
) => SpawnResult;

export class CodexSessionLogin {
  constructor(
    private readonly environment: EnvironmentSource = EnvironmentSource.from(process.env),
    private readonly spawn: SpawnFn = spawnSync,
  ) {}

  signIn(codexHome: string): void {
    const result = this.spawn("codex", ["login"], {
      stdio: "inherit",
      env: {
        ...process.env,
        PATH: this.environment.read("PATH") ?? process.env.PATH,
        CODEX_HOME: codexHome,
      },
    });

    if (result.error) {
      throw this.buildSpawnError(result.error);
    }
    if (result.status !== 0) {
      throw new Error(`codex login failed with exit code ${result.status ?? "unknown"}`);
    }
  }

  signInAndRead(codexHome: string): StoredCredential {
    this.signIn(codexHome);
    return CodexCurrentCredentialReader.open({ codexHome }).read();
  }

  private buildSpawnError(error: Error): Error {
    if ("code" in error && error.code === "ENOENT") {
      return new Error(
        "Codex CLI was not found in PATH. Install Codex CLI or add it to your shell PATH, then restart Nile.",
        { cause: error },
      );
    }
    return error;
  }
}
