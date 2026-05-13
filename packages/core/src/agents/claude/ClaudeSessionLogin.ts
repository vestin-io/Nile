import { spawn as spawnChild } from "node:child_process";
import { dirname } from "node:path";

import { EnvironmentSource } from "../../services/EnvironmentSource";
import type { ClaudeSessionCredential } from "../../services/credential/Types";
import { CurrentCredentialReader } from "./live-setup/CredentialReader";

type SpawnedProcess = {
  once(event: "error", listener: (error: Error) => void): unknown;
  once(event: "exit", listener: (code: number | null) => void): unknown;
};

type SpawnFn = (
  command: string,
  args: string[],
  options: {
    stdio: "inherit";
    env: NodeJS.ProcessEnv;
  },
) => SpawnedProcess;

export class ClaudeSessionLogin {
  constructor(
    private readonly environment: EnvironmentSource = EnvironmentSource.from(process.env),
    private readonly spawn: SpawnFn = spawnChild,
  ) {}

  async signIn(claudeHome: string): Promise<void> {
    const child = this.spawn("claude", ["login"], {
      stdio: "inherit",
      env: {
        ...process.env,
        PATH: mergePath(process.env.PATH, this.environment.read("PATH")),
        HOME: dirname(claudeHome),
      },
    });

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once("error", (error) => reject(this.buildSpawnError(error)));
      child.once("exit", (code) => resolve(code));
    });
    if (exitCode !== 0) {
      throw new Error(`claude login failed with exit code ${exitCode ?? "unknown"}`);
    }
  }

  async signInAndRead(claudeHome: string): Promise<ClaudeSessionCredential> {
    await this.signIn(claudeHome);
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

function mergePath(primary: string | undefined, secondary: string | null): string | undefined {
  const entries = [
    ...(primary?.split(":") ?? []),
    ...(secondary?.split(":") ?? []),
  ].map((entry) => entry.trim()).filter(Boolean);
  if (entries.length === 0) {
    return undefined;
  }
  return [...new Set(entries)].join(":");
}
