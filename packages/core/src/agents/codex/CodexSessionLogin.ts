import { spawn as spawnChild } from "node:child_process";

import { EnvironmentSource } from "../../services/EnvironmentSource";
import type { StoredCredential } from "../../services/credential/Types";
import { CodexCurrentCredentialReader } from "./live-setup/CurrentCredentialReader";

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

export class CodexSessionLogin {
  constructor(
    private readonly environment: EnvironmentSource = EnvironmentSource.from(process.env),
    private readonly spawn: SpawnFn = spawnChild,
  ) {}

  async signIn(codexHome: string): Promise<void> {
    const child = this.spawn("codex", ["login"], {
      stdio: "inherit",
      env: {
        ...process.env,
        PATH: mergePath(process.env.PATH, this.environment.read("PATH")),
        CODEX_HOME: codexHome,
      },
    });

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once("error", (error) => reject(this.buildSpawnError(error)));
      child.once("exit", (code) => resolve(code));
    });
    if (exitCode !== 0) {
      throw new Error(`codex login failed with exit code ${exitCode ?? "unknown"}`);
    }
  }

  async signInAndRead(codexHome: string): Promise<StoredCredential> {
    await this.signIn(codexHome);
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
