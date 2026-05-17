import { spawn as spawnChild } from "node:child_process";
import { dirname } from "node:path";

import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { ShellPath } from "@nile/core/services/ShellPath";
import type { StoredCredential } from "@nile/core/services/credential";
import { CodexAuthStore } from "./stores/CodexAuthStore";

type SpawnedProcess = {
  once(event: "error", listener: (error: Error) => void): unknown;
  once(event: "exit", listener: (code: number | null) => void): unknown;
};

type SpawnFn = (
  command: string,
  args: string[],
  options: {
    stdio: "inherit" | "ignore";
    env: NodeJS.ProcessEnv;
  },
) => SpawnedProcess;

const loginPollIntervalMs = 1000;
const loginTimeoutMs = 5 * 60 * 1000;

export class CodexSessionLogin {
  constructor(
    private readonly environment: EnvironmentSource = EnvironmentSource.from(process.env),
    private readonly spawn: SpawnFn = spawnChild,
    private readonly isElectronProcess: () => boolean = () => Boolean(process.versions.electron),
  ) {}

  async signIn(codexHome: string): Promise<void> {
    const env = {
      ...process.env,
      PATH: ShellPath.merge(process.env.PATH, this.environment.read("PATH")),
      CODEX_HOME: codexHome,
      HOME: dirname(codexHome),
    };

    await this.waitForExit(
      this.spawn("codex", ["login"], {
        stdio: this.isElectronProcess() ? "ignore" : "inherit",
        env,
      }),
      "codex login",
    );
  }

  async signInAndRead(codexHome: string): Promise<StoredCredential> {
    const authStore = new CodexAuthStore({ codexHome });
    const baseline = authStore.snapshot();
    await this.signIn(codexHome);
    return await this.waitForSignedInSession(authStore, baseline);
  }

  private buildSpawnError(error: Error): Error {
    if ("code" in error && error.code === "ENOENT") {
      return this.buildMissingCliError(error);
    }
    return error;
  }

  private buildMissingCliError(cause?: Error): Error {
    return new Error(
      "Codex CLI was not found in PATH. Install Codex CLI or add it to your shell PATH, then restart Nile.",
      cause ? { cause } : undefined,
    );
  }

  private async waitForSignedInSession(
    authStore: CodexAuthStore,
    baseline: string | null,
  ): Promise<StoredCredential> {
    const deadline = Date.now() + loginTimeoutMs;

    while (Date.now() < deadline) {
      const latest = authStore.readCredential();
      const snapshot = authStore.snapshot();
      if (latest?.kind === "openai_session" && (baseline === null || snapshot !== baseline)) {
        return latest;
      }

      await new Promise((resolve) => setTimeout(resolve, loginPollIntervalMs));
    }

    throw new Error(
      "Codex sign-in did not produce a new local OpenAI session. Complete the browser sign-in flow, then try again or use Import auth.json.",
    );
  }

  private async waitForExit(child: SpawnedProcess, operation: string): Promise<void> {
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once("error", (error) => reject(this.buildSpawnError(error)));
      child.once("exit", (code) => resolve(code));
    });
    if (exitCode !== 0) {
      throw new Error(`${operation} failed with exit code ${exitCode ?? "unknown"}`);
    }
  }
}
