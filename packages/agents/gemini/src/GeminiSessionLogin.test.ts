import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";

import { GeminiSessionLogin } from "./GeminiSessionLogin";

describe("GeminiSessionLogin", () => {
  afterEach(() => {
    restoreTty("stdin");
    restoreTty("stdout");
    process.env.PATH = originalPath;
    while (tempDirs.length > 0) {
      const path = tempDirs.pop();
      if (path) {
        rmSync(path, { recursive: true, force: true });
      }
    }
  });

  it("launches Gemini directly when attached to a terminal", async () => {
    setTty("stdin", true);
    setTty("stdout", true);
    const install = createGeminiCliInstall("terminal");
    process.env.PATH = install.bin;
    const calls: Array<{ command: string; args: string[]; stdio: "inherit" | "ignore"; env: NodeJS.ProcessEnv }> = [];
    const removedDirs: string[] = [];
    const login = new GeminiSessionLogin(
      EnvironmentSource.empty(),
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
      command: install.command,
      args: [],
      stdio: "inherit",
    });
    expect(calls[0]?.env.GEMINI_CLI_HOME).toBe("/tmp/test-home/.gemini");
    expect(removedDirs).toEqual(["/tmp/nile-gemini-wrapper"]);
  });

  it("opens Terminal for Gemini sign-in when no attached terminal is available", async () => {
    setTty("stdin", false);
    setTty("stdout", false);
    const install = createGeminiCliInstall("osascript");
    process.env.PATH = install.bin;
    const calls: Array<{ command: string; args: string[]; stdio: "inherit" | "ignore"; env: NodeJS.ProcessEnv }> = [];
    const login = new GeminiSessionLogin(
      EnvironmentSource.empty(),
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
    expect(calls[0]?.args[1]).toContain(install.command);
  });

  it("opens Terminal for Gemini sign-in inside Electron even when a TTY exists", async () => {
    setTty("stdin", true);
    setTty("stdout", true);
    const install = createGeminiCliInstall("electron");
    process.env.PATH = install.bin;
    const calls: Array<{ command: string; args: string[]; stdio: "inherit" | "ignore"; env: NodeJS.ProcessEnv }> = [];
    const login = new GeminiSessionLogin(
      EnvironmentSource.empty(),
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

  it("prefers an explicit Gemini CLI override over PATH auto-detection", async () => {
    setTty("stdin", true);
    setTty("stdout", true);
    const pathInstall = createGeminiCliInstall("path");
    const overrideInstall = createGeminiCliInstall("override");
    process.env.PATH = pathInstall.bin;
    const calls: Array<{ command: string; env: NodeJS.ProcessEnv }> = [];
    const login = new GeminiSessionLogin(
      EnvironmentSource.empty(),
      (command, _args, options) => {
        calls.push({ command, env: options.env });
        return exitedProcess(0);
      },
      () => false,
      () => "/tmp/nile-gemini-wrapper",
    );

    await login.signIn("/tmp/test-home/.gemini", {
      commandPathOverride: overrideInstall.command,
    });

    expect(calls[0]?.command).toBe(overrideInstall.command);
    expect(calls[0]?.env.PATH?.split(":")[1]).toBe(overrideInstall.bin);
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
const originalPath = process.env.PATH;
const tempDirs: string[] = [];

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

function createGeminiCliInstall(name: string): { bin: string; command: string } {
  const root = mkdtempSync(join(tmpdir(), `nile-gemini-cli-${name}-`));
  tempDirs.push(root);
  const bin = join(root, "bin");
  const command = join(bin, "gemini");
  mkdirSync(bin, { recursive: true });
  writeFileSync(command, "#!/usr/bin/env node\n", { encoding: "utf8", mode: 0o755 });
  return { bin, command };
}
