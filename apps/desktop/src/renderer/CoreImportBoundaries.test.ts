import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rendererDir = dirname(fileURLToPath(import.meta.url));
const desktopSrcDir = join(rendererDir, "..");
const allowedRuntimeCoreImports = new Set([
  "@nile/core/models/agent/registry/Capabilities",
  "@nile/core/models/agent/Definitions",
  "@nile/core/models/connection/enabled-agents-policy",
  "@nile/core/models/connection/requirements",
]);
const browserSafeFiles = [
  ...readSourceFiles(rendererDir),
  join(desktopSrcDir, "state", "Types.ts"),
  join(desktopSrcDir, "state", "connection", "List.ts"),
];

describe("desktop browser-safe core imports", () => {
  it("uses only explicit browser-safe core runtime imports", () => {
    const violations = browserSafeFiles.flatMap((path) => {
      const source = readFileSync(path, "utf8");
      const imports = [...source.matchAll(/import\s+(?!type\b)[^;]*from\s+["']([^"']+)["']/g)];
      return imports
        .map((match) => match[1] ?? "")
        .filter((specifier) => specifier.startsWith("@nile/core/"))
        .filter((specifier) => !allowedRuntimeCoreImports.has(specifier))
        .map((specifier) => ({ path, specifier }));
    });

    expect(violations).toEqual([]);
  });
});

function readSourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return readSourceFiles(path);
    }
    if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      return [path];
    }
    return [];
  });
}
