import { spawnSync } from "node:child_process";
import { dirname } from "node:path";

import { EnvironmentSource } from "../../services/EnvironmentSource";
import type { ClaudeSessionCredential } from "../../services/credential/Types";
import { CurrentCredentialReader } from "./live-setup/CredentialReader";

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

export class ClaudeSessionLogin {
  constructor(
    private readonly environment: EnvironmentSource = EnvironmentSource.from(process.env),
    private readonly spawn: SpawnFn = spawnSync,
  ) {}

  signIn(claudeHome: string): void {
    const result = this.spawn("claude", ["login"], {
      stdio: "inherit",
      env: {
        ...process.env,
        PATH: this.environment.read("PATH") ?? process.env.PATH,
        HOME: dirname(claudeHome),
      },
    });

    if (result.error) {
      throw this.buildSpawnError(result.error);
    }
    if (result.status !== 0) {
      throw new Error(`claude login failed with exit code ${result.status ?? "unknown"}`);
    }
  }

  signInAndRead(claudeHome: string): ClaudeSessionCredential {
    this.signIn(claudeHome);
    return CurrentCredentialReader.open({ claudeHome }).readSession();
  }

  private buildSpawnError(error: Error): Error {
    if ("code" in error && error.code === "ENOENT") {
      return new Error(
        "Claude CLI was not found in PATH. Install Claude CLI or add it to your shell PATH, then restart Nile.",
        { cause: error },
      );
    }
    return error;
  }
}
