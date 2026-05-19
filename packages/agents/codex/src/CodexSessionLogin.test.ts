import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { CodexSessionLogin } from "./CodexSessionLogin";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("CodexSessionLogin", () => {
  it("prefers the current process PATH and appends login-shell PATH entries", async () => {
    const toolRoot = mkdtempSync(join(tmpdir(), "nile-codex-path-"));
    tempDirs.push(toolRoot);
    const toolBin = join(toolRoot, "bin");
    mkdirSync(toolBin, { recursive: true });
    writeFileSync(join(toolBin, "codex"), "");

    let receivedCommand: string | undefined;
    let receivedPath: string | undefined;
    const originalPath = process.env.PATH;
    process.env.PATH = `${toolBin}:/Users/test/.nvm/bin:/usr/bin`;
    const login = new CodexSessionLogin(
      EnvironmentSource.from({ PATH: "/opt/homebrew/bin:/usr/bin:/usr/local/bin" }),
      (command, _args, options) => {
        receivedCommand = command;
        receivedPath = options?.env?.PATH;
        return {
          once(event: "error" | "exit", listener: ((error: Error) => void) | ((code: number | null) => void)) {
            if (event === "exit") {
              (listener as (code: number | null) => void)(0);
            }
            return this;
          },
        } as never;
      },
    );

    try {
      await login.signIn("/tmp/.codex");
    } finally {
      process.env.PATH = originalPath;
    }

    expect(receivedCommand).toBe(join(toolBin, "codex"));
    expect(receivedPath).toBe(`${toolBin}:/Users/test/.nvm/bin:/usr/bin:/opt/homebrew/bin:/usr/local/bin`);
  });

  it("returns a user-facing error when the codex CLI is missing from PATH", async () => {
    const login = new CodexSessionLogin(
      EnvironmentSource.empty(),
      () => ({
        once(event: "error" | "exit", listener: ((error: Error) => void) | ((code: number | null) => void)) {
          if (event === "error") {
            (listener as (error: Error) => void)(Object.assign(new Error("spawn codex ENOENT"), { code: "ENOENT" }));
          }
          return this;
        },
      }) as never,
    );

    await expect(login.signIn("/tmp/.codex")).rejects.toThrow(
      "Codex CLI was not found in PATH. Install Codex CLI or add it to your shell PATH, then restart Nile.",
    );
  });

  it("runs codex login in the background and waits for a new OpenAI session in Electron", async () => {
    const loginRoot = mkdtempSync(join(tmpdir(), "nile-codex-login-test-"));
    tempDirs.push(loginRoot);
    const codexHome = join(loginRoot, ".codex");
    mkdirSync(codexHome, { recursive: true });
    const toolBin = join(loginRoot, "bin");
    mkdirSync(toolBin, { recursive: true });
    writeFileSync(join(toolBin, "codex"), "");

    let command: string | null = null;
    let receivedStdio: "inherit" | "ignore" | "pipe" | null = null;
    const originalPath = process.env.PATH;
    process.env.PATH = toolBin;
    const login = new CodexSessionLogin(
      EnvironmentSource.empty(),
      (spawnedCommand, _args, options) => {
        command = spawnedCommand;
        receivedStdio = options.stdio;
        if (spawnedCommand === join(toolBin, "codex")) {
          writeFileSync(
            join(codexHome, "auth.json"),
            JSON.stringify({
              OPENAI_API_KEY: null,
              tokens: {
                id_token: "id-token",
                access_token: "access-token",
                refresh_token: "refresh-token",
                account_id: "acct-electron",
              },
            }),
          );
        }
        return {
          once(event: "error" | "exit", listener: ((error: Error) => void) | ((code: number | null) => void)) {
            if (event === "exit") {
              (listener as (code: number | null) => void)(0);
            }
            return this;
          },
        } as never;
      },
      () => true,
    );

    try {
      await expect(login.signInAndRead(codexHome)).resolves.toEqual(
        expect.objectContaining({
          kind: "openai_session",
          accountId: "acct-electron",
        }),
      );
    } finally {
      process.env.PATH = originalPath;
    }

    expect(command).toBe(join(toolBin, "codex"));
    expect(receivedStdio).toBe("pipe");
  });

  it("opens the emitted Codex sign-in URL when a browser opener is available", async () => {
    let openedUrl: string | null = null;
    let receivedStdio: "inherit" | "ignore" | "pipe" | null = null;
    const login = new CodexSessionLogin(
      EnvironmentSource.empty(),
      (_spawnedCommand, _args, options) => {
        receivedStdio = options.stdio;
        const child = new StubSpawnedProcess();
        queueMicrotask(() => {
          child.stdout.emit("data", "Starting local login server on http://localhost:1455.\n");
          child.stdout.emit(
            "data",
            "https://auth.openai.com/oauth/authorize?response_type=code&state=test-state\n",
          );
          child.emit("exit", 0);
        });
        return child as never;
      },
      () => true,
    );

    await expect(
      login.signIn("/tmp/.codex", {
        openExternalUrl: async (url) => {
          openedUrl = url;
        },
      }),
    ).resolves.toBeUndefined();

    expect(receivedStdio).toBe("pipe");
    expect(openedUrl).toBe("https://auth.openai.com/oauth/authorize?response_type=code&state=test-state");
  });

  it("includes captured Codex stderr when Electron login exits non-zero", async () => {
    const login = new CodexSessionLogin(
      EnvironmentSource.empty(),
      () => {
        const child = new StubSpawnedProcess();
        queueMicrotask(() => {
          child.stderr.emit("data", "Error logging in: browser launch failed\n");
          child.emit("exit", 1);
        });
        return child as never;
      },
      () => true,
    );

    await expect(login.signIn("/tmp/.codex")).rejects.toThrow(
      "codex login failed with exit code 1: Error logging in: browser launch failed",
    );
  });
});

class StubSpawnedProcess extends EventEmitter {
  readonly stdout = new EventEmitter();
  readonly stderr = new EventEmitter();

  kill(): boolean {
    queueMicrotask(() => {
      this.emit("exit", 1);
    });
    return true;
  }
}
