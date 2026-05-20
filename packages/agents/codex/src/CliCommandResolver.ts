import { existsSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";

import { listCommandsInNvm, listCommandsInPath } from "@nile/core/services/RuntimeCommandDiscovery";

export type CodexCliCommandResolution = {
  command: string | null;
  invalidCommandPaths: readonly string[];
};

type CliCommandResolutionOptions = {
  homeDirectory?: string | null;
};

export class CliCommandResolver {
  constructor(
    private readonly pathExists: (path: string) => boolean = existsSync,
    private readonly realpath: (path: string) => string = realpathSync,
    private readonly readDirectoryNames: (path: string) => string[] = (path) =>
      readdirSync(path, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name),
  ) {}

  resolve(pathValue: string, options: CliCommandResolutionOptions = {}): CodexCliCommandResolution {
    const invalidCommandPaths: string[] = [];

    for (const command of this.listPathCommands(pathValue)) {
      if (this.pathExists(command) && this.readVendorBinaryPath(command)) {
        return {
          command,
          invalidCommandPaths,
        };
      }
      if (this.pathExists(command)) {
        invalidCommandPaths.push(command);
      }
    }

    for (const command of this.listNvmCommands(options.homeDirectory)) {
      if (invalidCommandPaths.includes(command)) {
        continue;
      }
      if (this.pathExists(command) && this.readVendorBinaryPath(command)) {
        return {
          command,
          invalidCommandPaths,
        };
      }
      if (this.pathExists(command)) {
        invalidCommandPaths.push(command);
      }
    }

    return {
      command: null,
      invalidCommandPaths,
    };
  }

  resolveExplicit(commandPath: string | null | undefined): CodexCliCommandResolution {
    const normalized = commandPath?.trim();
    if (!normalized) {
      return {
        command: null,
        invalidCommandPaths: [],
      };
    }

    if (this.pathExists(normalized) && this.readVendorBinaryPath(normalized)) {
      return {
        command: normalized,
        invalidCommandPaths: [],
      };
    }

    return {
      command: null,
      invalidCommandPaths: [normalized],
    };
  }

  private readVendorBinaryPath(command: string): string | null {
    let resolvedCommandPath: string;
    try {
      resolvedCommandPath = this.realpath(command);
    } catch {
      return null;
    }

    const packageRoot = dirname(dirname(resolvedCommandPath));
    for (const candidate of this.listVendorBinaryCandidates(packageRoot)) {
      if (this.pathExists(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private listPathCommands(pathValue: string): string[] {
    return listCommandsInPath(pathValue, "codex");
  }

  private listNvmCommands(homeDirectory: string | null | undefined): string[] {
    return listCommandsInNvm("codex", homeDirectory, this.readDirectoryNames);
  }

  private listVendorBinaryCandidates(packageRoot: string): string[] {
    const targetTriple = readTargetTriple();
    if (!targetTriple) {
      return [];
    }

    const binaryName = process.platform === "win32" ? "codex.exe" : "codex";
    const candidates = [
      join(packageRoot, "vendor", targetTriple, "codex", binaryName),
    ];
    const optionalPackageName = readOptionalVendorPackageName();
    if (optionalPackageName) {
      candidates.unshift(
        join(packageRoot, "node_modules", optionalPackageName, "vendor", targetTriple, "codex", binaryName),
      );
    }
    return candidates;
  }
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

function readOptionalVendorPackageName(): string | null {
  if (process.platform === "darwin" && process.arch === "arm64") {
    return "@openai/codex-darwin-arm64";
  }
  if (process.platform === "darwin" && process.arch === "x64") {
    return "@openai/codex-darwin-x64";
  }
  if (process.platform === "linux" && process.arch === "arm64") {
    return "@openai/codex-linux-arm64";
  }
  if (process.platform === "linux" && process.arch === "x64") {
    return "@openai/codex-linux-x64";
  }
  if (process.platform === "win32" && process.arch === "arm64") {
    return "@openai/codex-win32-arm64";
  }
  if (process.platform === "win32" && process.arch === "x64") {
    return "@openai/codex-win32-x64";
  }
  return null;
}
