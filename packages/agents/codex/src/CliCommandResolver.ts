import { existsSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { listCommandsInNvm, listCommandsInPath } from "@nile/core/services/RuntimeCommandDiscovery";

export type CodexCliCommandResolution = {
  command: string | null;
  launcherCommand: string | null;
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
      const vendorBinaryPath = this.readVendorBinaryPath(command);
      if (this.pathExists(command) && vendorBinaryPath) {
        return {
          command: vendorBinaryPath,
          launcherCommand: command,
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
      const vendorBinaryPath = this.readVendorBinaryPath(command);
      if (this.pathExists(command) && vendorBinaryPath) {
        return {
          command: vendorBinaryPath,
          launcherCommand: command,
          invalidCommandPaths,
        };
      }
      if (this.pathExists(command)) {
        invalidCommandPaths.push(command);
      }
    }

    return {
      command: null,
      launcherCommand: null,
      invalidCommandPaths,
    };
  }

  resolveExplicit(commandPath: string | null | undefined): CodexCliCommandResolution {
    const normalized = commandPath?.trim();
    if (!normalized) {
      return {
        command: null,
        launcherCommand: null,
        invalidCommandPaths: [],
      };
    }

    const vendorBinaryPath = this.readVendorBinaryPath(normalized);
    if (this.pathExists(normalized) && vendorBinaryPath) {
      return {
        command: vendorBinaryPath,
        launcherCommand: normalized,
        invalidCommandPaths: [],
      };
    }

    return {
      command: null,
      launcherCommand: null,
      invalidCommandPaths: [normalized],
    };
  }

  private readVendorBinaryPath(command: string): string | null {
    for (const candidateRoot of this.listCommandPathCandidates(command)) {
      if (this.isVendorBinaryPath(candidateRoot)) {
        return candidateRoot;
      }

      for (const candidate of this.listVendorBinaryCandidates(candidateRoot)) {
        if (this.pathExists(candidate)) {
          return candidate;
        }
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

  private listVendorBinaryCandidates(commandPath: string): string[] {
    const targetTriple = readTargetTriple();
    if (!targetTriple) {
      return [];
    }

    const binaryName = readVendorBinaryName();
    const commandDirectory = dirname(commandPath);
    const commandParentDirectory = dirname(commandDirectory);
    const installRoots = new Set<string>([
      commandDirectory,
      commandParentDirectory,
      join(commandParentDirectory, "lib"),
    ]);
    const codexPackageRoots = new Set<string>([
      join(commandDirectory, "node_modules", "@openai", "codex"),
      join(commandParentDirectory, "node_modules", "@openai", "codex"),
      join(commandParentDirectory, "lib", "node_modules", "@openai", "codex"),
    ]);

    const candidates: string[] = [];
    for (const installRoot of installRoots) {
      candidates.push(join(installRoot, "vendor", targetTriple, "codex", binaryName));
      candidates.push(join(installRoot, "vendor", targetTriple, "bin", binaryName));
    }
    const optionalPackageName = readOptionalVendorPackageName();
    if (optionalPackageName) {
      for (const installRoot of installRoots) {
        candidates.push(
          join(installRoot, "node_modules", optionalPackageName, "vendor", targetTriple, "codex", binaryName),
        );
        candidates.push(
          join(installRoot, "node_modules", optionalPackageName, "vendor", targetTriple, "bin", binaryName),
        );
      }
      for (const packageRoot of codexPackageRoots) {
        candidates.push(
          join(packageRoot, "node_modules", optionalPackageName, "vendor", targetTriple, "codex", binaryName),
        );
        candidates.push(
          join(packageRoot, "node_modules", optionalPackageName, "vendor", targetTriple, "bin", binaryName),
        );
      }
    }
    for (const packageRoot of codexPackageRoots) {
      candidates.push(join(packageRoot, "vendor", targetTriple, "codex", binaryName));
      candidates.push(join(packageRoot, "vendor", targetTriple, "bin", binaryName));
    }

    return Array.from(new Set(candidates));
  }

  private listCommandPathCandidates(command: string): string[] {
    const candidates = [command];
    try {
      candidates.push(this.realpath(command));
    } catch {
      return candidates;
    }
    return Array.from(new Set(candidates));
  }

  private isVendorBinaryPath(commandPath: string): boolean {
    const binaryName = readVendorBinaryName();
    if (basename(commandPath).toLowerCase() !== binaryName.toLowerCase()) {
      return false;
    }

    const commandDirectory = dirname(commandPath);
    const parentDirectory = dirname(commandDirectory);
    if (basename(commandDirectory) === "codex" && basename(parentDirectory) === readTargetTriple()) {
      return basename(dirname(parentDirectory)) === "vendor";
    }
    if (basename(commandDirectory) === "bin" && basename(parentDirectory) === readTargetTriple()) {
      return basename(dirname(parentDirectory)) === "vendor";
    }
    return false;
  }
}

function readVendorBinaryName(): string {
  return process.platform === "win32" ? "codex.exe" : "codex";
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
