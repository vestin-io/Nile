import { readdirSync } from "node:fs";
import { delimiter, join } from "node:path";

export function listCommandsInPath(pathValue: string, commandName: string): string[] {
  return pathValue
    .split(delimiter)
    .filter((value) => value.trim().length > 0)
    .map((entry) => join(entry, commandName));
}

export function listCommandsInNvm(
  commandName: string,
  homeDirectory: string | null | undefined,
  readDirectoryNames: (path: string) => string[] = readNodeVersionDirectories,
): string[] {
  const normalizedHome = homeDirectory?.trim();
  if (!normalizedHome) {
    return [];
  }

  const nodeVersionsRoot = join(normalizedHome, ".nvm", "versions", "node");
  let versionNames: string[];
  try {
    versionNames = readDirectoryNames(nodeVersionsRoot);
  } catch {
    return [];
  }

  return versionNames
    .sort(compareVersionNamesDescending)
    .map((versionName) => join(nodeVersionsRoot, versionName, "bin", commandName));
}

function readNodeVersionDirectories(path: string): string[] {
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function compareVersionNamesDescending(left: string, right: string): number {
  const leftParts = parseVersionName(left);
  const rightParts = parseVersionName(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart !== rightPart) {
      return rightPart - leftPart;
    }
  }
  return right.localeCompare(left);
}

function parseVersionName(input: string): number[] {
  return input
    .replace(/^v/i, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((value) => Number.isFinite(value) ? value : 0);
}
