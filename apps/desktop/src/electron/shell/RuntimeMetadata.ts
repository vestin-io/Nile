import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function readDesktopCurrentDir(importMetaUrl: string): string {
  return typeof __dirname === "string" ? __dirname : dirname(fileURLToPath(importMetaUrl));
}

export function readDesktopPackageVersion(currentDir: string): string {
  const packageJsonPath = join(currentDir, "..", "..", "package.json");
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  return parsed.version?.trim() || "0.0.0";
}
