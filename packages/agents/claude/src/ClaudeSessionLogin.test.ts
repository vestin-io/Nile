import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";

import { ClaudeSessionLogin } from "./ClaudeSessionLogin";

describe("ClaudeSessionLogin", () => {
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

  it("runs claude login directly when attached to a terminal", async () => {
    setTty("stdin", true);
    setTty("stdout", true);
    const install = createClaudeCliInstall("terminal");
    process.env.PATH = install.bin;
    const calls: Array<{ command: string; args: string[]; stdio: "inherit" | "ignore" }> = [];
    const login = new ClaudeSessionLogin(
      EnvironmentSource.empty(),
      (command, args, options) => {
        calls.push({ command, args, stdio: options.stdio });
        return exitedProcess(0);
      },
      () => false,
      "darwin",
    );

    await login.signIn("/tmp/test-home/.claude");

    expect(calls).toEqual([
      {
        command: install.command,
        args: ["login"],
        stdio: "inherit",
      },
    ]);
  });

  it("opens Terminal for Claude sign-in when no attached terminal is available", async () => {
    setTty("stdin", false);
    setTty("stdout", false);
    const install = createClaudeCliInstall("osascript");
    process.env.PATH = install.bin;
    const calls: Array<{ command: string; args: string[]; stdio: "inherit" | "ignore" }> = [];
    const login = new ClaudeSessionLogin(
      EnvironmentSource.empty(),
      (command, args, options) => {
        calls.push({ command, args, stdio: options.stdio });
        return exitedProcess(0);
      },
      () => false,
      "darwin",
    );

    await login.signIn("/tmp/test-home/.claude");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      command: "osascript",
      stdio: "ignore",
    });
    expect(calls[0]?.args[1]).toContain('tell application "Terminal"');
    expect(calls[0]?.args[1]).toContain("HOME='/tmp/test-home'");
    expect(calls[0]?.args[1]).toContain(install.command.replaceAll("\\", "\\\\"));
    expect(calls[0]?.args[1]).toContain("login");
  });

  it("opens Terminal for Claude sign-in inside Electron even when a TTY exists", async () => {
    setTty("stdin", true);
    setTty("stdout", true);
    const install = createClaudeCliInstall("electron");
    process.env.PATH = install.bin;
    const calls: Array<{ command: string; stdio: "inherit" | "ignore" }> = [];
    const login = new ClaudeSessionLogin(
      EnvironmentSource.empty(),
      (command, _args, options) => {
        calls.push({ command, stdio: options.stdio });
        return exitedProcess(0);
      },
      () => true,
      "darwin",
    );

    await login.signIn("/tmp/test-home/.claude");

    expect(calls).toEqual([
      {
        command: "osascript",
        stdio: "ignore",
      },
    ]);
  });

  it("opens a Windows terminal for Claude sign-in when no attached terminal is available", async () => {
    setTty("stdin", false);
    setTty("stdout", false);
    const install = createClaudeCliInstall("windows");
    process.env.PATH = install.bin;
    const calls: Array<{ command: string; args: string[]; stdio: "inherit" | "ignore" }> = [];
    const login = new ClaudeSessionLogin(
      EnvironmentSource.empty(),
      (command, args, options) => {
        calls.push({ command, args, stdio: options.stdio });
        return exitedProcess(0);
      },
      () => true,
      "win32",
    );

    await login.signIn("C:\\Users\\tester\\.claude");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      command: "cmd.exe",
      stdio: "ignore",
    });
    expect(calls[0]?.args).toEqual(expect.arrayContaining(["/d", "/c", "start", "", "cmd.exe", "/k"]));
    const script = calls[0]?.args.at(-1) ?? "";
    expect(script).toContain('set "HOME=C:\\Users\\tester"');
    expect(script).toContain(install.command);
    expect(script).toContain("login");
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
      "darwin",
    );

    await expect(login.signIn("/tmp/test-home/.claude")).rejects.toThrow(
      "Claude CLI was not found in PATH. Install Claude CLI or add it to your shell PATH, then restart Nile.",
    );
  });

  it("prefers an explicit Claude CLI override over PATH auto-detection", async () => {
    setTty("stdin", true);
    setTty("stdout", true);
    const pathInstall = createClaudeCliInstall("path");
    const overrideInstall = createClaudeCliInstall("override");
    process.env.PATH = pathInstall.bin;
    const calls: Array<{ command: string; args: string[]; stdio: "inherit" | "ignore" }> = [];
    const login = new ClaudeSessionLogin(
      EnvironmentSource.empty(),
      (command, args, options) => {
        calls.push({ command, args, stdio: options.stdio });
        return exitedProcess(0);
      },
      () => false,
      "darwin",
    );

    await login.signIn("/tmp/test-home/.claude", {
      commandPathOverride: overrideInstall.command,
    });

    expect(calls).toEqual([
      {
        command: overrideInstall.command,
        args: ["login"],
        stdio: "inherit",
      },
    ]);
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

function createClaudeCliInstall(name: string): { bin: string; command: string } {
  const root = mkdtempSync(join(tmpdir(), `nile-claude-cli-${name}-`));
  tempDirs.push(root);
  const bin = join(root, "bin");
  const command = join(bin, "claude");
  mkdirSync(bin, { recursive: true });
  writeFileSync(command, "#!/usr/bin/env node\n", { encoding: "utf8", mode: 0o755 });
  return { bin, command };
}
