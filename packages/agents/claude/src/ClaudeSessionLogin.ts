import { spawn as spawnChild } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";

import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { ShellPath } from "@nile/core/services/ShellPath";
import type { ClaudeSessionCredential } from "@nile/core/services/credential";
import { CurrentCredentialReader } from "./live-setup/CredentialReader";
import { ClaudeCredentialStore } from "./Store";

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

export class ClaudeSessionLogin {
  constructor(
    private readonly environment: EnvironmentSource = EnvironmentSource.from(process.env),
    private readonly spawn: SpawnFn = spawnChild,
    private readonly isElectronProcess: () => boolean = () => Boolean(process.versions.electron),
  ) {}

  async signIn(claudeHome: string): Promise<void> {
    const env = this.buildLoginEnv(claudeHome);

    if (this.canUseAttachedTerminal()) {
      await this.waitForExit(
        this.spawn("claude", ["login"], {
          stdio: "inherit",
          env,
        }),
        "claude login",
      );
      return;
    }

    await this.waitForExit(
      this.spawn("osascript", ["-e", this.buildTerminalScript(env)], {
        stdio: "ignore",
        env,
      }),
      "opening Terminal for Claude sign-in",
    );
  }

  async signInAndRead(claudeHome: string): Promise<ClaudeSessionCredential> {
    const credentialStore = new ClaudeCredentialStore(claudeHome);
    const baseline = credentialStore.snapshot();
    await this.signIn(claudeHome);

    if (this.canUseAttachedTerminal()) {
      return CurrentCredentialReader.open({ claudeHome }).readSession();
    }

    return await this.waitForSignedInSession(claudeHome, baseline);
  }

  private buildLoginEnv(claudeHome: string): NodeJS.ProcessEnv {
    return {
      ...process.env,
      PATH: ShellPath.merge(process.env.PATH, this.environment.read("PATH")),
      HOME: dirname(claudeHome),
    };
  }

  private buildTerminalScript(env: NodeJS.ProcessEnv): string {
    const claudeCommand = this.resolveClaudeCommand(env.PATH ?? "");
    const command = [
      `export HOME=${this.quoteForShell(env.HOME ?? "")}`,
      `export PATH=${this.quoteForShell(env.PATH ?? "")}`,
      `printf '%s\\n\\n' ${this.quoteForShell(
        "Complete Claude sign-in in this Terminal window using the account you want to add to Nile. When Claude finishes logging in, close this window and return to Nile.",
      )}`,
      this.quoteForShell(claudeCommand),
      "login",
    ].join("; ");

    return [
      'tell application "Terminal"',
      `do script "${this.escapeForAppleScript(command)}"`,
      "activate",
      "end tell",
    ].join("\n");
  }

  private canUseAttachedTerminal(): boolean {
    return !this.isElectronProcess() && process.stdin.isTTY === true && process.stdout.isTTY === true;
  }

  private quoteForShell(value: string): string {
    return `'${value.replaceAll("'", `'\"'\"'`)}'`;
  }

  private resolveClaudeCommand(pathValue: string): string {
    for (const entry of pathValue.split(delimiter).filter((value) => value.trim().length > 0)) {
      const candidate = join(entry, "claude");
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    return "claude";
  }

  private escapeForAppleScript(value: string): string {
    return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  }

  private async waitForSignedInSession(
    claudeHome: string,
    baseline: string | null,
  ): Promise<ClaudeSessionCredential> {
    const credentialStore = new ClaudeCredentialStore(claudeHome);
    const deadline = Date.now() + loginTimeoutMs;

    while (Date.now() < deadline) {
      const snapshot = credentialStore.snapshot();
      if (snapshot !== null && (baseline === null || snapshot !== baseline)) {
        try {
          return CurrentCredentialReader.open({ claudeHome }).readSession();
        } catch {
          // Credential file changed before Claude session fields are ready.
        }
      }

      await new Promise((resolve) => setTimeout(resolve, loginPollIntervalMs));
    }

    throw new Error(
      "Claude sign-in did not produce a new local Claude session. Complete the login flow in the Terminal window, then try again.",
    );
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
