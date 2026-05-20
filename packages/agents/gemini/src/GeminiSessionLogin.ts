import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawn as spawnChild } from "node:child_process";
import { delimiter, dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { RuntimeCommandResolver } from "@nile/core/services/RuntimeCommandResolver";
import { ShellPath } from "@nile/core/services/ShellPath";

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

export class GeminiSessionLogin {
  private readonly runtimeCommandResolver = new RuntimeCommandResolver("gemini");

  constructor(
    private readonly environment: EnvironmentSource = EnvironmentSource.from(process.env),
    private readonly spawn: SpawnFn = spawnChild,
    private readonly isElectronProcess: () => boolean = () => Boolean(process.versions.electron),
    private readonly createWrapperDirectory: (() => string) | null = null,
    private readonly removeDirectory: (path: string) => void = (path) => {
      rmSync(path, { recursive: true, force: true });
    },
  ) {}

  async signIn(geminiHome: string, options: { commandPathOverride?: string | null } = {}): Promise<void> {
    const openWrapperDir = this.readOpenWrapperDirectory();
    const basePath = ShellPath.merge(process.env.PATH, this.environment.read("PATH")) ?? "";
    const geminiCommand = this.resolveGeminiCommand(basePath, options.commandPathOverride);
    const env = {
      ...process.env,
      PATH: ShellPath.merge(
        [openWrapperDir, dirname(geminiCommand), process.env.PATH, this.environment.read("PATH")]
          .filter((value): value is string => Boolean(value))
          .join(delimiter),
        null,
      ),
      GEMINI_CLI_HOME: geminiHome,
      HOME: dirname(geminiHome),
    };

    if (this.canUseAttachedTerminal()) {
      try {
        await this.waitForExit(
          this.spawn(geminiCommand, [], {
            stdio: "inherit",
            env,
          }),
          "gemini sign-in",
        );
      } finally {
        this.removeDirectory(openWrapperDir);
      }
      return;
    }

    try {
      await this.waitForExit(
        this.spawn("osascript", ["-e", this.buildTerminalScript(env, openWrapperDir, geminiCommand)], {
          stdio: "ignore",
          env,
        }),
        "opening Terminal for Gemini sign-in",
      );
    } catch (error) {
      this.removeDirectory(openWrapperDir);
      throw error;
    }
  }

  private buildSpawnError(error: Error): Error {
    if ("code" in error && error.code === "ENOENT") {
      return new Error(
        "Gemini CLI was not found in PATH. Install Gemini CLI or add it to your shell PATH, then restart Nile.",
        { cause: error },
      );
    }
    return error;
  }

  private canUseAttachedTerminal(): boolean {
    return !this.isElectronProcess() && process.stdin.isTTY === true && process.stdout.isTTY === true;
  }

  private readOpenWrapperDirectory(): string {
    return this.createWrapperDirectory?.() ?? this.createOpenWrapperDirectory();
  }

  private createOpenWrapperDirectory(): string {
    const wrapperDir = mkdtempSync(join(tmpdir(), "nile-gemini-open-"));
    const wrapperPath = join(wrapperDir, "open");
    writeFileSync(
      wrapperPath,
      [
        "#!/bin/sh",
        "url=\"$1\"",
        "case \"$url\" in",
        "  https://accounts.google.com/o/oauth2/v2/auth*)",
        "    case \"$url\" in",
        "      *\"prompt=\"*) rewritten=\"$url\" ;;",
        "      *\"?\"*) rewritten=\"${url}&prompt=select_account\" ;;",
        "      *) rewritten=\"${url}?prompt=select_account\" ;;",
        "    esac",
        "    exec /usr/bin/open \"$rewritten\"",
        "    ;;",
        "  *)",
        "    exec /usr/bin/open \"$@\"",
        "    ;;",
        "esac",
        "",
      ].join("\n"),
      { mode: 0o700 },
    );
    chmodSync(wrapperPath, 0o700);
    return wrapperDir;
  }

  private buildTerminalScript(
    env: NodeJS.ProcessEnv,
    openWrapperDir: string,
    geminiCommand: string,
  ): string {
    const command = [
      `trap "rm -rf ${this.quoteForShell(openWrapperDir)}" EXIT`,
      `export GEMINI_CLI_HOME=${this.quoteForShell(env.GEMINI_CLI_HOME ?? "")}`,
      `export HOME=${this.quoteForShell(env.HOME ?? "")}`,
      `export PATH=${this.quoteForShell(env.PATH ?? "")}`,
      `printf '%s\\n\\n' ${this.quoteForShell(
        "Complete Gemini sign-in in this Terminal window using the account you want to add to Nile. When Gemini finishes logging in, close this window and return to Nile.",
      )}`,
      this.quoteForShell(geminiCommand),
    ].join("; ");

    return [
      'tell application "Terminal"',
      `do script "${this.escapeForAppleScript(command)}"`,
      "activate",
      "end tell",
    ].join("\n");
  }

  private quoteForShell(value: string): string {
    return `'${value.replaceAll("'", `'\"'\"'`)}'`;
  }

  private resolveGeminiCommand(pathValue: string, commandPathOverride?: string | null): string {
    const explicitResolution = this.runtimeCommandResolver.resolveExplicit(commandPathOverride);
    if (explicitResolution.command) {
      return explicitResolution.command;
    }
    if (commandPathOverride?.trim()) {
      throw new Error(
        `Gemini CLI command override was not found (${commandPathOverride.trim()}). Update the override or use auto-detected CLI command, then try again.`,
      );
    }

    const resolution = this.runtimeCommandResolver.resolve(pathValue, {
      homeDirectory: this.environment.read("HOME") ?? process.env.HOME,
    });
    if (resolution.command) {
      return resolution.command;
    }

    throw new Error(
      "Gemini CLI was not found in PATH. Install Gemini CLI or add it to your shell PATH, then restart Nile.",
    );
  }

  private escapeForAppleScript(value: string): string {
    return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
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
