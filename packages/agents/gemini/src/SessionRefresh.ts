import { spawn as spawnChild } from "node:child_process";
import { delimiter, dirname } from "node:path";

import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { RuntimeCommandResolver } from "@nile/core/services/RuntimeCommandResolver";
import { ShellPath } from "@nile/core/services/ShellPath";
import { GEMINI_HOME_RESOLVER } from "./Home";

const REFRESH_TIMEOUT_MS = 15_000;
const REFRESH_SETTLE_MS = 1_500;
const OUTPUT_SNIPPET_LIMIT = 400;
const REFRESH_ARGS = ["--skip-trust", "--prompt", "refresh auth"] as const;

type OutputStream = {
  setEncoding(encoding: BufferEncoding): void;
  on(event: "data", listener: (chunk: string) => void): unknown;
};

type SpawnedProcess = {
  stdin: { end(chunk?: string): void } | null;
  stdout: OutputStream | null;
  stderr: OutputStream | null;
  kill(signal?: NodeJS.Signals | number): boolean;
  once(event: "error", listener: (error: Error) => void): unknown;
  once(event: "exit", listener: (code: number | null) => void): unknown;
};

type SpawnFn = (
  command: string,
  args: string[],
  options: {
    env: NodeJS.ProcessEnv;
    stdio: ["pipe", "pipe", "pipe"];
  },
) => SpawnedProcess;

export class GeminiSessionRefresh {
  constructor(
    private readonly spawn: SpawnFn = spawnChild,
    private readonly runtimeCommandResolver: RuntimeCommandResolver = new RuntimeCommandResolver("gemini"),
    private readonly sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    private readonly processEnvironment: NodeJS.ProcessEnv = process.env,
  ) {}

  async refresh(geminiHome: string, environment: EnvironmentSource): Promise<void> {
    const resolvedGeminiHome = GEMINI_HOME_RESOLVER.resolve(geminiHome);
    const geminiCommand = this.resolveGeminiCommand(environment);
    const spawnEnvironment = this.buildSpawnEnvironment(resolvedGeminiHome, geminiCommand, environment);
    await this.runGemini(geminiCommand, spawnEnvironment);
    await this.sleep(REFRESH_SETTLE_MS);
  }

  private resolveGeminiCommand(environment: EnvironmentSource): string {
    const pathValue = ShellPath.merge(
      environment.read("PATH") ?? undefined,
      this.processEnvironment.PATH ?? null,
    ) ?? "";
    const homeDirectory = environment.read("HOME") ?? this.processEnvironment.HOME ?? null;
    const resolution = this.runtimeCommandResolver.resolve(pathValue, { homeDirectory });
    if (resolution.command) {
      return resolution.command;
    }

    throw new Error(
      "Gemini CLI was not found in PATH. Install Gemini CLI or add it to your shell PATH, then restart Nile.",
    );
  }

  private buildSpawnEnvironment(
    geminiHome: string,
    geminiCommand: string,
    environment: EnvironmentSource,
  ): NodeJS.ProcessEnv {
    const mergedPath = ShellPath.merge(
      [dirname(geminiCommand), environment.read("PATH"), this.processEnvironment.PATH]
        .filter((value): value is string => Boolean(value))
        .join(delimiter),
      null,
    );

    return {
      ...this.processEnvironment,
      PATH: mergedPath,
      GEMINI_CLI_HOME: geminiHome,
      GEMINI_CLI_TRUST_WORKSPACE: "true",
      HOME: dirname(geminiHome),
    };
  }

  private async runGemini(command: string, env: NodeJS.ProcessEnv): Promise<void> {
    const child = this.spawn(command, [...REFRESH_ARGS], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = this.captureOutput(child.stdout);
    const stderr = this.captureOutput(child.stderr);
    child.stdin?.end();

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, REFRESH_TIMEOUT_MS);

    try {
      const exitCode = await new Promise<number | null>((resolve, reject) => {
        child.once("error", (error) => reject(this.buildSpawnError(error)));
        child.once("exit", (code) => resolve(code));
      });
      if (timedOut) {
        throw new Error(this.formatFailureMessage("Gemini CLI token refresh timed out", stdout.read(), stderr.read()));
      }
      if (exitCode !== 0) {
        throw new Error(
          this.formatFailureMessage(
            `Gemini CLI token refresh failed with exit code ${exitCode ?? "unknown"}`,
            stdout.read(),
            stderr.read(),
          ),
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private captureOutput(stream: OutputStream | null): { read(): string } {
    if (!stream) {
      return { read: () => "" };
    }

    let output = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      output += chunk;
    });
    return {
      read: () => output,
    };
  }

  private formatFailureMessage(base: string, stdout: string, stderr: string): string {
    const snippet = this.summarizeOutput(stderr) || this.summarizeOutput(stdout);
    return snippet ? `${base}. CLI output: ${snippet}` : base;
  }

  private summarizeOutput(value: string): string {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (!normalized) {
      return "";
    }
    if (normalized.length <= OUTPUT_SNIPPET_LIMIT) {
      return normalized;
    }
    return `...${normalized.slice(-OUTPUT_SNIPPET_LIMIT)}`;
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
}
