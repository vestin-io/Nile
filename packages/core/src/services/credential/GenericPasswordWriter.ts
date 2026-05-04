import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { SecurityCliResult } from "./SecurityCli";

export type GenericPasswordWriteInput = {
  account: string;
  service: string;
  secret: string;
  update: boolean;
};

export type GenericPasswordReadInput = {
  account: string;
  service: string;
  includeSecret: boolean;
};

export type GenericPasswordDeleteInput = {
  account: string;
  service: string;
};

type SpawnSyncFn = (
  command: string,
  args: readonly string[],
  options: {
    encoding: "utf8";
    input?: string;
  },
) => SpawnSyncReturns<string>;

export class GenericPasswordWriter {
  constructor(
    private readonly spawn: SpawnSyncFn = spawnSync,
    private readonly resolveHelperPath: () => string = readKeychainHelperPath,
  ) {}

  write(input: GenericPasswordWriteInput): SecurityCliResult {
    const result = this.spawn(this.resolveHelperPath(), buildHelperArgs(input), {
      encoding: "utf8",
      input: input.secret,
    });
    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  }

  read(input: GenericPasswordReadInput): SecurityCliResult {
    const result = this.spawn(this.resolveHelperPath(), buildReadArgs(input), {
      encoding: "utf8",
    });
    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  }

  remove(input: GenericPasswordDeleteInput): SecurityCliResult {
    const result = this.spawn(this.resolveHelperPath(), buildDeleteArgs(input), {
      encoding: "utf8",
    });
    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  }
}

function buildHelperArgs(input: GenericPasswordWriteInput): string[] {
  return [
    "write-generic-password",
    "--account",
    input.account,
    "--service",
    input.service,
    "--mode",
    input.update ? "upsert" : "add",
  ];
}

function buildReadArgs(input: GenericPasswordReadInput): string[] {
  const args = [
    "read-generic-password",
    "--account",
    input.account,
    "--service",
    input.service,
  ];
  if (input.includeSecret) {
    args.push("--secret");
  }
  return args;
}

function buildDeleteArgs(input: GenericPasswordDeleteInput): string[] {
  return [
    "delete-generic-password",
    "--account",
    input.account,
    "--service",
    input.service,
  ];
}

function readKeychainHelperPath(): string {
  const currentDir = resolveCurrentDir();
  for (const helperPath of readHelperPathCandidates(currentDir)) {
    if (existsSync(helperPath)) {
      return helperPath;
    }
  }

  throw new Error(
    "Nile keychain helper was not found. Run npm run build:core before using keychain-backed credential storage.",
  );
}

function resolveCurrentDir(): string {
  if (typeof __filename === "string") {
    return dirname(__filename);
  }

  const moduleUrl = import.meta?.url;
  if (typeof moduleUrl === "string") {
    return dirname(fileURLToPath(moduleUrl));
  }

  throw new Error("Nile keychain helper path could not be resolved for this runtime.");
}

export function readHelperPathCandidates(currentDir: string): string[] {
  const colocatedHelperPath = join(currentDir, "KeychainGenericPasswordHelper");
  const distHelperPath = join(currentDir, "..", "..", "..", "dist", "services", "credential", "KeychainGenericPasswordHelper");

  return uniqueHelperPaths([
    readUnpackedAsarPath(colocatedHelperPath),
    colocatedHelperPath,
    readUnpackedAsarPath(distHelperPath),
    distHelperPath,
  ]);
}

function readUnpackedAsarPath(path: string): string {
  return path.includes("app.asar") ? path.replaceAll("app.asar", "app.asar.unpacked") : path;
}

function uniqueHelperPaths(paths: string[]): string[] {
  return [...new Set(paths)];
}
