import { spawn as spawnChild } from "node:child_process";
import { dirname, posix, win32 } from "node:path";

import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { RuntimeCommandResolver } from "@nile/core/services/RuntimeCommandResolver";
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
  private readonly runtimeCommandResolver = new RuntimeCommandResolver("claude");

  constructor(
    private readonly environment: EnvironmentSource = EnvironmentSource.from(process.env),
    private readonly spawn: SpawnFn = spawnChild,
    private readonly isElectronProcess: () => boolean = () => Boolean(process.versions.electron),
    private readonly platform: NodeJS.Platform = process.platform,
  ) {}

  async signIn(claudeHome: string, options: { commandPathOverride?: string | null } = {}): Promise<void> {
    const env = this.buildLoginEnv(claudeHome, options.commandPathOverride);
    const claudeCommand = this.resolveClaudeCommand(env.PATH ?? "", options.commandPathOverride);

    if (this.canUseAttachedTerminal()) {
      await this.waitForExit(
        this.spawn(claudeCommand, ["login"], {
          stdio: "inherit",
          env,
        }),
        "claude login",
      );
      return;
    }

    await this.waitForExit(
      this.spawn(...this.readDetachedTerminalSpawn(env, claudeCommand)),
      this.platform === "win32"
        ? "opening terminal for Claude sign-in"
        : "opening Terminal for Claude sign-in",
    );
  }

  async signInAndRead(
    claudeHome: string,
    options: { commandPathOverride?: string | null } = {},
  ): Promise<ClaudeSessionCredential> {
    const credentialStore = new ClaudeCredentialStore(claudeHome);
    const baseline = credentialStore.snapshot();
    await this.signIn(claudeHome, options);

    if (this.canUseAttachedTerminal()) {
      return CurrentCredentialReader.open({ claudeHome }).readSession();
    }

    return await this.waitForSignedInSession(claudeHome, baseline);
  }

  private buildLoginEnv(claudeHome: string, commandPathOverride?: string | null): NodeJS.ProcessEnv {
    const pathValue = ShellPath.merge(process.env.PATH, this.environment.read("PATH")) ?? "";
    const claudeCommand = this.resolveClaudeCommand(pathValue, commandPathOverride);
    return {
      ...process.env,
      PATH: ShellPath.merge(dirname(claudeCommand), pathValue),
      HOME: this.readHomeDirectory(claudeHome),
    };
  }

  private readDetachedTerminalSpawn(
    env: NodeJS.ProcessEnv,
    claudeCommand: string,
  ): Parameters<SpawnFn> {
    if (this.platform === "win32") {
      return [
        "cmd.exe",
        ["/d", "/c", "start", "", "cmd.exe", "/k", this.buildWindowsTerminalCommand(env, claudeCommand)],
        {
          stdio: "ignore",
          env,
        },
      ];
    }

    return [
      "osascript",
      ["-e", this.buildMacTerminalScript(env, claudeCommand)],
      {
        stdio: "ignore",
        env,
      },
    ];
  }

  private buildMacTerminalScript(env: NodeJS.ProcessEnv, claudeCommand: string): string {
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

  private buildWindowsTerminalCommand(env: NodeJS.ProcessEnv, claudeCommand: string): string {
    return [
      this.writeWindowsEnv("HOME", env.HOME ?? ""),
      this.writeWindowsEnv("PATH", env.PATH ?? ""),
      "echo Complete Claude sign-in in this terminal window using the account you want to add to Nile.",
      "echo.",
      `${this.quoteForCmd(claudeCommand)} login`,
    ].join(" && ");
  }

  private canUseAttachedTerminal(): boolean {
    return !this.isElectronProcess() && process.stdin.isTTY === true && process.stdout.isTTY === true;
  }

  private readHomeDirectory(claudeHome: string): string {
    return this.platform === "win32" ? win32.dirname(claudeHome) : posix.dirname(claudeHome);
  }

  private quoteForShell(value: string): string {
    return `'${value.replaceAll("'", `'\"'\"'`)}'`;
  }

  private writeWindowsEnv(key: string, value: string): string {
    return `set "${key}=${value.replaceAll('"', '""')}"`;
  }

  private quoteForCmd(value: string): string {
    return `"${value.replaceAll('"', '""')}"`;
  }

  private resolveClaudeCommand(pathValue: string, commandPathOverride?: string | null): string {
    const explicitResolution = this.runtimeCommandResolver.resolveExplicit(commandPathOverride);
    if (explicitResolution.command) {
      return explicitResolution.command;
    }
    if (commandPathOverride?.trim()) {
      throw new Error(
        `Claude CLI command override was not found (${commandPathOverride.trim()}). Update the override or use auto-detected CLI command, then try again.`,
      );
    }

    const resolution = this.runtimeCommandResolver.resolve(pathValue, {
      homeDirectory: this.environment.read("HOME") ?? process.env.HOME,
    });
    if (resolution.command) {
      return resolution.command;
    }

    throw new Error(
      "Claude CLI was not found in PATH. Install Claude CLI or add it to your shell PATH, then restart Nile.",
    );
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
