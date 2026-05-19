import { spawn as spawnChild } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";

import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { ShellPath } from "@nile/core/services/ShellPath";
import type { StoredCredential } from "@nile/core/services/credential";
import { CodexAuthStore } from "./stores/CodexAuthStore";

type SpawnedProcess = {
  stdout?: NodeJS.ReadableStream | null;
  stderr?: NodeJS.ReadableStream | null;
  once(event: "error", listener: (error: Error) => void): unknown;
  once(event: "exit", listener: (code: number | null) => void): unknown;
  kill?(signal?: NodeJS.Signals | number): boolean;
};

type SpawnFn = (
  command: string,
  args: string[],
  options: {
    stdio: "inherit" | "ignore" | "pipe";
    env: NodeJS.ProcessEnv;
  },
) => SpawnedProcess;

type BrowserOpener = (url: string) => Promise<void>;

type LoginExecutionState = {
  browserOpenError: Error | null;
  browserOpenPromise: Promise<void> | null;
  loginUrl: string | null;
  output: string[];
};

const loginPollIntervalMs = 1000;
const loginTimeoutMs = 5 * 60 * 1000;
const loginUrlPattern = /https:\/\/auth\.openai\.com\/\S+/;

export class CodexSessionLogin {
  constructor(
    private readonly environment: EnvironmentSource = EnvironmentSource.from(process.env),
    private readonly spawn: SpawnFn = spawnChild,
    private readonly isElectronProcess: () => boolean = () => Boolean(process.versions.electron),
  ) {}

  async signIn(codexHome: string, options: { openExternalUrl?: BrowserOpener } = {}): Promise<void> {
    const env = this.buildLoginEnv(codexHome);
    const codexCommand = this.resolveCodexCommand(env.PATH ?? "");
    const shouldCaptureOutput = this.isElectronProcess() || options.openExternalUrl !== undefined;
    const child = this.spawn(codexCommand, ["login"], {
      stdio: shouldCaptureOutput ? "pipe" : "inherit",
      env,
    });
    const state = this.captureLoginOutput(child, options.openExternalUrl);

    await this.waitForExit(
      child,
      "codex login",
      state,
    );
  }

  async signInAndRead(
    codexHome: string,
    options: { openExternalUrl?: BrowserOpener } = {},
  ): Promise<StoredCredential> {
    const authStore = new CodexAuthStore({ codexHome });
    const baseline = authStore.snapshot();
    await this.signIn(codexHome, options);
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

  private captureLoginOutput(
    child: SpawnedProcess,
    openExternalUrl: BrowserOpener | undefined,
  ): LoginExecutionState {
    const state: LoginExecutionState = {
      browserOpenError: null,
      browserOpenPromise: null,
      loginUrl: null,
      output: [],
    };

    this.attachOutputListener(child.stdout, child, state, openExternalUrl);
    this.attachOutputListener(child.stderr, child, state, openExternalUrl);
    return state;
  }

  private attachOutputListener(
    stream: NodeJS.ReadableStream | null | undefined,
    child: SpawnedProcess,
    state: LoginExecutionState,
    openExternalUrl: BrowserOpener | undefined,
  ): void {
    if (!stream) {
      return;
    }

    stream.on("data", (chunk: string | Buffer) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      if (!text) {
        return;
      }

      state.output.push(text);
      const loginUrl = this.extractLoginUrl(state.output.join(""));
      if (!loginUrl || state.loginUrl === loginUrl) {
        return;
      }

      state.loginUrl = loginUrl;
      if (!openExternalUrl || state.browserOpenPromise) {
        return;
      }

      state.browserOpenPromise = openExternalUrl(loginUrl).catch((error) => {
        state.browserOpenError = this.buildBrowserOpenError(loginUrl, error);
        child.kill?.();
      });
    });
  }

  private extractLoginUrl(output: string): string | null {
    const match = output.match(loginUrlPattern);
    return match ? match[0] : null;
  }

  private buildBrowserOpenError(loginUrl: string, cause: unknown): Error {
    const detail = cause instanceof Error && cause.message
      ? `: ${cause.message}`
      : "";
    return new Error(
      `Failed to open the Codex sign-in URL automatically${detail} (${loginUrl})`,
      cause instanceof Error ? { cause } : undefined,
    );
  }

  private buildLoginEnv(codexHome: string): NodeJS.ProcessEnv {
    return {
      ...process.env,
      PATH: ShellPath.merge(process.env.PATH, this.environment.read("PATH")),
      CODEX_HOME: codexHome,
      HOME: dirname(codexHome),
    };
  }

  private resolveCodexCommand(pathValue: string): string {
    for (const entry of pathValue.split(delimiter).filter((value) => value.trim().length > 0)) {
      const candidate = join(entry, "codex");
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    return "codex";
  }

  private buildLoginFailure(
    operation: string,
    exitCode: number | null,
    state: LoginExecutionState,
  ): Error {
    const detail = this.extractFailureDetail(state.output.join(""));
    if (detail) {
      return new Error(`${operation} failed with exit code ${exitCode ?? "unknown"}: ${detail}`);
    }
    return new Error(`${operation} failed with exit code ${exitCode ?? "unknown"}`);
  }

  private extractFailureDetail(output: string): string | null {
    const lines = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) =>
        !line.startsWith("Starting local login server on ")
        && !line.startsWith("If your browser did not open")
        && !line.startsWith("On a remote or headless machine?")
        && !line.startsWith("navigate to this URL to authenticate:")
        && !/^https:\/\/auth\.openai\.com\//.test(line));
    return lines.length > 0 ? lines[lines.length - 1] : null;
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

  private async waitForExit(
    child: SpawnedProcess,
    operation: string,
    state: LoginExecutionState,
  ): Promise<void> {
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once("error", (error) => reject(this.buildSpawnError(error)));
      child.once("exit", (code) => resolve(code));
    });
    if (state.browserOpenPromise) {
      await state.browserOpenPromise.catch(() => {});
    }
    if (state.browserOpenError) {
      throw state.browserOpenError;
    }
    if (exitCode !== 0) {
      throw this.buildLoginFailure(operation, exitCode, state);
    }
  }
}
