import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { NileLogger } from "@nile/core/services/NileLogger";
import { CodexSessionLogin } from "./CodexSessionLogin";

const tempDirs: string[] = [];
const originalHome = process.env.HOME;

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
  process.env.HOME = originalHome;
  vi.restoreAllMocks();
});

describe("CodexSessionLogin", () => {
  it("skips broken PATH candidates and prefers the first working Codex CLI", async () => {
    const brokenInstall = createCodexCliInstall("broken", { includeVendor: false, layout: "legacy" });
    const workingInstall = createCodexCliInstall("working");

    let receivedCommand: string | undefined;
    let receivedPath: string | undefined;
    const originalPath = process.env.PATH;
    process.env.PATH = `${brokenInstall.bin}:${workingInstall.bin}:/usr/bin`;
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
      undefined,
      NileLogger.silent(),
    );

    try {
      await login.signIn("/tmp/.codex");
    } finally {
      process.env.PATH = originalPath;
    }

    expect(receivedCommand).toBe(join(workingInstall.bin, "codex"));
    expect(receivedPath).toBe(`${workingInstall.bin}:${brokenInstall.bin}:/usr/bin:/opt/homebrew/bin:/usr/local/bin`);
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
      undefined,
      NileLogger.silent(),
    );

    await expect(login.signIn("/tmp/.codex")).rejects.toThrow(
      "Codex CLI was not found in PATH. Install Codex CLI or add it to your shell PATH, then restart Nile.",
    );
  });

  it("returns a user-facing error when every PATH Codex install is broken", async () => {
    const brokenInstall = createCodexCliInstall("broken-only", { includeVendor: false, layout: "legacy" });
    const homeRoot = mkdtempSync(join(tmpdir(), "nile-codex-home-empty-"));
    tempDirs.push(homeRoot);

    const originalPath = process.env.PATH;
    process.env.PATH = brokenInstall.bin;
    process.env.HOME = homeRoot;
    const login = new CodexSessionLogin(EnvironmentSource.empty(), undefined, undefined, NileLogger.silent());

    try {
      await expect(login.signIn("/tmp/.codex")).rejects.toThrow(
        `Codex CLI was found in PATH, but its packaged binary is missing (${join(brokenInstall.bin, "codex")}).`,
      );
    } finally {
      process.env.PATH = originalPath;
    }
  });

  it("falls back to a working .nvm Codex install when PATH candidates are broken", async () => {
    const homeRoot = mkdtempSync(join(tmpdir(), "nile-codex-home-"));
    tempDirs.push(homeRoot);
    const brokenInstall = createCodexCliInstall("broken-path", { includeVendor: false, layout: "legacy" });
    const fallbackInstall = createNvmCodexCliInstall(homeRoot, "v22.22.0");

    let receivedCommand: string | undefined;
    const originalPath = process.env.PATH;
    process.env.PATH = brokenInstall.bin;
    process.env.HOME = homeRoot;
    const login = new CodexSessionLogin(
      EnvironmentSource.from({ HOME: homeRoot }),
      (command) => {
        receivedCommand = command;
        return {
          once(event: "error" | "exit", listener: ((error: Error) => void) | ((code: number | null) => void)) {
            if (event === "exit") {
              (listener as (code: number | null) => void)(0);
            }
            return this;
          },
        } as never;
      },
      undefined,
      NileLogger.silent(),
    );

    try {
      await login.signIn("/tmp/.codex");
    } finally {
      process.env.PATH = originalPath;
    }

    expect(receivedCommand).toBe(fallbackInstall.command);
  });

  it("prefers an explicit Codex CLI override over PATH auto-detection", async () => {
    const pathInstall = createCodexCliInstall("path-working");
    const overrideInstall = createCodexCliInstall("override-working");

    let receivedCommand: string | undefined;
    const originalPath = process.env.PATH;
    process.env.PATH = pathInstall.bin;
    const login = new CodexSessionLogin(
      EnvironmentSource.empty(),
      (command) => {
        receivedCommand = command;
        return {
          once(event: "error" | "exit", listener: ((error: Error) => void) | ((code: number | null) => void)) {
            if (event === "exit") {
              (listener as (code: number | null) => void)(0);
            }
            return this;
          },
        } as never;
      },
      undefined,
      NileLogger.silent(),
    );

    try {
      await login.signIn("/tmp/.codex", {
        commandPathOverride: join(overrideInstall.bin, "codex"),
      });
    } finally {
      process.env.PATH = originalPath;
    }

    expect(receivedCommand).toBe(join(overrideInstall.bin, "codex"));
  });

  it("runs codex login in the background and waits for a new OpenAI session in Electron", async () => {
    const loginRoot = mkdtempSync(join(tmpdir(), "nile-codex-login-test-"));
    tempDirs.push(loginRoot);
    const codexHome = join(loginRoot, ".codex");
    mkdirSync(codexHome, { recursive: true });
    const install = createCodexCliInstall("electron-login");

    let command: string | null = null;
    let receivedStdio: "inherit" | "ignore" | "pipe" | null = null;
    const originalPath = process.env.PATH;
    process.env.PATH = install.bin;
    const login = new CodexSessionLogin(
      EnvironmentSource.empty(),
      (spawnedCommand, _args, options) => {
        command = spawnedCommand;
        receivedStdio = options.stdio;
        if (spawnedCommand === join(install.bin, "codex")) {
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
      NileLogger.silent(),
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

    expect(command).toBe(join(install.bin, "codex"));
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
      NileLogger.silent(),
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
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
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
      NileLogger.silent(),
    );

    await expect(login.signIn("/tmp/.codex")).rejects.toThrow(
      "codex login failed with exit code 1: Error logging in: browser launch failed",
    );
    expect(consoleError).toHaveBeenCalledWith(
      "[desktop][codex-login] login failed",
      expect.objectContaining({
        exitCode: 1,
        output: "Error logging in: browser launch failed\n",
      }),
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

function createCodexCliInstall(
  name: string,
  options: { includeVendor?: boolean; layout?: "optional-package" | "legacy" } = {},
): { bin: string; root: string } {
  const root = mkdtempSync(join(tmpdir(), `nile-codex-cli-${name}-`));
  tempDirs.push(root);

  const bin = join(root, "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "codex"), "#!/usr/bin/env node\n", "utf8");

  if (options.includeVendor !== false) {
    const targetTriple = readTargetTriple();
    if (!targetTriple) {
      throw new Error(`Unsupported test platform: ${process.platform}/${process.arch}`);
    }

    const vendorRoot = options.layout === "legacy"
      ? join(root, "vendor", targetTriple, "codex")
      : join(root, "node_modules", "@openai", readOptionalPackageDirectoryName(), "vendor", targetTriple, "codex");
    mkdirSync(vendorRoot, { recursive: true });
    writeFileSync(join(vendorRoot, "codex"), "", "utf8");
  }

  return { bin, root };
}

function createNvmCodexCliInstall(
  homeRoot: string,
  versionName: string,
  options: { includeVendor?: boolean; layout?: "optional-package" | "legacy" } = {},
): { command: string } {
  const installRoot = join(homeRoot, ".nvm", "versions", "node", versionName);
  const bin = join(installRoot, "bin");
  mkdirSync(bin, { recursive: true });
  const command = join(bin, "codex");
  writeFileSync(command, "#!/usr/bin/env node\n", "utf8");

  if (options.includeVendor !== false) {
    const targetTriple = readTargetTriple();
    if (!targetTriple) {
      throw new Error(`Unsupported test platform: ${process.platform}/${process.arch}`);
    }

    const vendorRoot = options.layout === "legacy"
      ? join(installRoot, "vendor", targetTriple, "codex")
      : join(installRoot, "node_modules", "@openai", readOptionalPackageDirectoryName(), "vendor", targetTriple, "codex");
    mkdirSync(vendorRoot, { recursive: true });
    writeFileSync(join(vendorRoot, "codex"), "", "utf8");
  }

  return { command };
}

function readTargetTriple(): string | null {
  if (process.platform === "darwin" && process.arch === "arm64") {
    return "aarch64-apple-darwin";
  }
  if (process.platform === "darwin" && process.arch === "x64") {
    return "x86_64-apple-darwin";
  }
  if (process.platform === "linux" && process.arch === "arm64") {
    return "aarch64-unknown-linux-gnu";
  }
  if (process.platform === "linux" && process.arch === "x64") {
    return "x86_64-unknown-linux-gnu";
  }
  if (process.platform === "win32" && process.arch === "arm64") {
    return "aarch64-pc-windows-msvc";
  }
  if (process.platform === "win32" && process.arch === "x64") {
    return "x86_64-pc-windows-msvc";
  }
  return null;
}

function readOptionalPackageDirectoryName(): string {
  if (process.platform === "darwin" && process.arch === "arm64") {
    return "codex-darwin-arm64";
  }
  if (process.platform === "darwin" && process.arch === "x64") {
    return "codex-darwin-x64";
  }
  if (process.platform === "linux" && process.arch === "arm64") {
    return "codex-linux-arm64";
  }
  if (process.platform === "linux" && process.arch === "x64") {
    return "codex-linux-x64";
  }
  if (process.platform === "win32" && process.arch === "arm64") {
    return "codex-win32-arm64";
  }
  if (process.platform === "win32" && process.arch === "x64") {
    return "codex-win32-x64";
  }
  throw new Error(`Unsupported test platform: ${process.platform}/${process.arch}`);
}
