import { afterEach, describe, expect, it } from "vitest";

import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";

import { GeminiSessionLogin } from "./GeminiSessionLogin";

describe("GeminiSessionLogin", () => {
  afterEach(() => {
    restoreTty("stdin");
    restoreTty("stdout");
  });

  it("launches Gemini directly when attached to a terminal", async () => {
    setTty("stdin", true);
    setTty("stdout", true);
    const calls: Array<{ command: string; args: string[]; stdio: "inherit" | "ignore"; env: NodeJS.ProcessEnv }> = [];
    const removedDirs: string[] = [];
    const login = new GeminiSessionLogin(
      EnvironmentSource.from({ PATH: "/custom/bin" }),
      (command, args, options) => {
        calls.push({ command, args, stdio: options.stdio, env: options.env });
        return exitedProcess(0);
      },
      () => false,
      () => "/tmp/nile-gemini-wrapper",
      (path) => {
        removedDirs.push(path);
      },
    );

    await login.signIn("/tmp/test-home/.gemini");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      command: "gemini",
      args: [],
      stdio: "inherit",
    });
    expect(calls[0]?.env.GEMINI_CLI_HOME).toBe("/tmp/test-home/.gemini");
    expect(removedDirs).toEqual(["/tmp/nile-gemini-wrapper"]);
  });

  it("opens Terminal for Gemini sign-in when no attached terminal is available", async () => {
    setTty("stdin", false);
    setTty("stdout", false);
    const calls: Array<{ command: string; args: string[]; stdio: "inherit" | "ignore"; env: NodeJS.ProcessEnv }> = [];
    const login = new GeminiSessionLogin(
      EnvironmentSource.from({ PATH: "/custom/bin" }),
      (command, args, options) => {
        calls.push({ command, args, stdio: options.stdio, env: options.env });
        return exitedProcess(0);
      },
      () => false,
      () => "/tmp/nile-gemini-wrapper",
    );

    await login.signIn("/tmp/test-home/.gemini");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      command: "osascript",
      stdio: "ignore",
    });
    expect(calls[0]?.args[1]).toContain('tell application "Terminal"');
    expect(calls[0]?.args[1]).toContain("GEMINI_CLI_HOME='/tmp/test-home/.gemini'");
    expect(calls[0]?.args[1]).toContain('trap \\"rm -rf \'/tmp/nile-gemini-wrapper\'\\" EXIT');
    expect(calls[0]?.args[1]).toContain("gemini");
  });

  it("opens Terminal for Gemini sign-in inside Electron even when a TTY exists", async () => {
    setTty("stdin", true);
    setTty("stdout", true);
    const calls: Array<{ command: string; args: string[]; stdio: "inherit" | "ignore"; env: NodeJS.ProcessEnv }> = [];
    const login = new GeminiSessionLogin(
      EnvironmentSource.from({ PATH: "/custom/bin" }),
      (command, args, options) => {
        calls.push({ command, args, stdio: options.stdio, env: options.env });
        return exitedProcess(0);
      },
      () => true,
    );

    await login.signIn("/tmp/test-home/.gemini");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      command: "osascript",
      stdio: "ignore",
    });
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
