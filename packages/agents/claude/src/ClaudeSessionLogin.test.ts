import { afterEach, describe, expect, it } from "vitest";

import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";

import { ClaudeSessionLogin } from "./ClaudeSessionLogin";

describe("ClaudeSessionLogin", () => {
  afterEach(() => {
    restoreTty("stdin");
    restoreTty("stdout");
  });

  it("runs claude login directly when attached to a terminal", async () => {
    setTty("stdin", true);
    setTty("stdout", true);
    const calls: Array<{ command: string; args: string[]; stdio: "inherit" | "ignore" }> = [];
    const login = new ClaudeSessionLogin(
      EnvironmentSource.from({ PATH: "/custom/bin" }),
      (command, args, options) => {
        calls.push({ command, args, stdio: options.stdio });
        return exitedProcess(0);
      },
      () => false,
    );

    await login.signIn("/tmp/test-home/.claude");

    expect(calls).toEqual([
      {
        command: "claude",
        args: ["login"],
        stdio: "inherit",
      },
    ]);
  });

  it("opens Terminal for Claude sign-in when no attached terminal is available", async () => {
    setTty("stdin", false);
    setTty("stdout", false);
    const calls: Array<{ command: string; args: string[]; stdio: "inherit" | "ignore" }> = [];
    const login = new ClaudeSessionLogin(
      EnvironmentSource.empty(),
      (command, args, options) => {
        calls.push({ command, args, stdio: options.stdio });
        return exitedProcess(0);
      },
      () => false,
    );

    await login.signIn("/tmp/test-home/.claude");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      command: "osascript",
      stdio: "ignore",
    });
    expect(calls[0]?.args[1]).toContain('tell application "Terminal"');
    expect(calls[0]?.args[1]).toContain("HOME='/tmp/test-home'");
    expect(calls[0]?.args[1]).toContain("claude");
    expect(calls[0]?.args[1]).toContain("login");
  });

  it("opens Terminal for Claude sign-in inside Electron even when a TTY exists", async () => {
    setTty("stdin", true);
    setTty("stdout", true);
    const calls: Array<{ command: string; stdio: "inherit" | "ignore" }> = [];
    const login = new ClaudeSessionLogin(
      EnvironmentSource.empty(),
      (command, _args, options) => {
        calls.push({ command, stdio: options.stdio });
        return exitedProcess(0);
      },
      () => true,
    );

    await login.signIn("/tmp/test-home/.claude");

    expect(calls).toEqual([
      {
        command: "osascript",
        stdio: "ignore",
      },
    ]);
  });

  it("returns a user-facing error when the Claude CLI is missing from PATH", async () => {
    const login = new ClaudeSessionLogin(
      EnvironmentSource.empty(),
      () => ({
        once(event: "error" | "exit", listener: ((error: Error) => void) | ((code: number | null) => void)) {
          if (event === "error") {
            (listener as (error: Error) => void)(Object.assign(new Error("spawn claude ENOENT"), { code: "ENOENT" }));
          }
          return undefined;
        },
      }) as never,
      () => false,
    );

    await expect(login.signIn("/tmp/test-home/.claude")).rejects.toThrow(
      "Claude CLI was not found in PATH. Install Claude CLI or add it to your shell PATH, then restart Nile.",
    );
  });
});

function exitedProcess(code: number | null) {
  return {
    once(event: "error" | "exit", listener: ((error: Error) => void) | ((code: number | null) => void)) {
      if (event === "exit") {
        (listener as (code: number | null) => void)(code);
      }
      return undefined;
    },
  };
}

const originalDescriptors = {
  stdin: Object.getOwnPropertyDescriptor(process.stdin, "isTTY"),
  stdout: Object.getOwnPropertyDescriptor(process.stdout, "isTTY"),
};

function setTty(target: "stdin" | "stdout", value: boolean): void {
  Object.defineProperty(process[target], "isTTY", {
    configurable: true,
    value,
  });
}

function restoreTty(target: "stdin" | "stdout"): void {
  const descriptor = originalDescriptors[target];
  if (descriptor) {
    Object.defineProperty(process[target], "isTTY", descriptor);
    return;
  }

  delete (process[target] as { isTTY?: boolean }).isTTY;
}
