import { afterEach, describe, expect, it } from "vitest";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { EventEmitter } from "node:events";

import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { GeminiSessionRefresh } from "./SessionRefresh";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("GeminiSessionRefresh", () => {
  it("runs gemini against the resolved Gemini home and sends quit input", async () => {
    const root = mkdtempSync(join(tmpdir(), "nile-gemini-refresh-"));
    tempDirs.push(root);
    const binDir = join(root, "bin");
    mkdirSync(binDir, { recursive: true });
    const geminiCommand = join(binDir, "gemini");
    writeFileSync(geminiCommand, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    chmodSync(geminiCommand, 0o755);

    const nestedGeminiHome = join(root, ".gemini");
    mkdirSync(nestedGeminiHome, { recursive: true });
    writeFileSync(join(nestedGeminiHome, "settings.json"), "{}\n", "utf8");
    writeFileSync(join(nestedGeminiHome, "google_accounts.json"), "{}\n", "utf8");
    writeFileSync(join(nestedGeminiHome, "oauth_creds.json"), "{}\n", "utf8");

    const calls: Array<{
      command: string;
      args: string[];
      env: NodeJS.ProcessEnv;
      input: string;
      stdio: ["pipe", "pipe", "pipe"];
    }> = [];

    const refresh = new GeminiSessionRefresh(
      (command, args, options) => {
        const stdout = new EventEmitter();
        const stderr = new EventEmitter();
        const record = {
          command,
          args,
          env: options.env,
          input: "",
          stdio: options.stdio,
        };
        calls.push(record);
        return {
          stdin: {
            end(chunk?: string) {
              record.input = chunk ?? "";
            },
          },
          stdout: {
            setEncoding() {},
            on(event: "data", listener: (chunk: string) => void) {
              stdout.on(event, listener);
              return undefined;
            },
          },
          stderr: {
            setEncoding() {},
            on(event: "data", listener: (chunk: string) => void) {
              stderr.on(event, listener);
              return undefined;
            },
          },
          kill() {
            return true;
          },
          once(
            event: "error" | "exit",
            listener: ((error: Error) => void) | ((code: number | null) => void),
          ) {
            if (event === "exit") {
              setTimeout(() => (listener as (code: number | null) => void)(0), 0);
            }
            return undefined;
          },
        } as never;
      },
      undefined,
      async () => {},
      { PATH: "/usr/bin", HOME: root },
    );

    await refresh.refresh(root, EnvironmentSource.from({ PATH: binDir, HOME: root }));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe(geminiCommand);
    expect(calls[0]?.args).toEqual(["--skip-trust", "--prompt", "refresh auth"]);
    expect(calls[0]?.input).toBe("");
    expect(calls[0]?.stdio).toEqual(["pipe", "pipe", "pipe"]);
    expect(calls[0]?.env.GEMINI_CLI_HOME).toBe(nestedGeminiHome);
    expect(calls[0]?.env.GEMINI_CLI_TRUST_WORKSPACE).toBe("true");
    expect(calls[0]?.env.HOME).toBe(dirname(nestedGeminiHome));
    expect(calls[0]?.env.PATH?.split(":").slice(0, 2)).toEqual([binDir, "/usr/bin"]);
  });

  it("includes CLI stderr in the refresh failure message", async () => {
    const refresh = new GeminiSessionRefresh(
      () => {
        const stderr = new EventEmitter();
        return {
          stdin: {
            end() {
              stderr.emit("data", "TTY required for auth refresh");
            },
          },
          stdout: {
            setEncoding() {},
            on() {
              return undefined;
            },
          },
          stderr: {
            setEncoding() {},
            on(event: "data", listener: (chunk: string) => void) {
              stderr.on(event, listener);
              return undefined;
            },
          },
          kill() {
            return true;
          },
          once(
            event: "error" | "exit",
            listener: ((error: Error) => void) | ((code: number | null) => void),
          ) {
            if (event === "exit") {
              setTimeout(() => (listener as (code: number | null) => void)(55), 0);
            }
            return undefined;
          },
        } as never;
      },
      {
        resolve() {
          return { command: "/tmp/gemini" };
        },
      } as never,
      async () => {},
      { PATH: "/usr/bin", HOME: "/tmp" },
    );

    await expect(refresh.refresh("/tmp/.gemini", EnvironmentSource.from({ PATH: "/usr/bin", HOME: "/tmp" })))
      .rejects
      .toThrow("Gemini CLI token refresh failed with exit code 55. CLI output: TTY required for auth refresh");
  });
});
