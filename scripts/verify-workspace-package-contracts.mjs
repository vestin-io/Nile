import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { readWorkspacePackageExports } from "./workspace-package-exports.mjs";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

for (const workspacePackage of readWorkspacePackageExports(rootDir)) {
  const packageJson = JSON.parse(readFileSync(join(workspacePackage.packageDir, "package.json"), "utf8"));
  await verifyPackage(workspacePackage.packageDir, packageJson);
}

async function verifyPackage(packageDir, packageJson) {
  assertNoSourceDeclarations(packageDir, packageJson.name);

  for (const [subpath, target] of Object.entries(packageJson.exports ?? {})) {
    const runtimeTarget =
      typeof target === "string"
        ? target
        : typeof target === "object" && target !== null
          ? target.default
          : null;
    const typesTarget =
      typeof target === "object" && target !== null && typeof target.types === "string"
        ? target.types
        : subpath === "." && typeof packageJson.types === "string"
          ? packageJson.types
          : null;

    if (typeof runtimeTarget !== "string" || typeof typesTarget !== "string") {
      continue;
    }

    const runtimeExports = readRuntimeExports(packageDir, runtimeTarget).sort();
    const declaredExports = parseDeclaredRuntimeExports(
      readFileSync(join(packageDir, typesTarget.slice(2)), "utf8"),
    ).sort();

    if (!sameMembers(runtimeExports, declaredExports)) {
      throw new Error(
        [
          `Package contract mismatch for ${packageJson.name}${subpath === "." ? "" : `/${subpath.slice(2)}`}`,
          `runtime: ${runtimeExports.join(", ") || "(none)"}`,
          `types: ${declaredExports.join(", ") || "(none)"}`,
        ].join("\n"),
      );
    }
  }
}

function readRuntimeExports(packageDir, runtimeTarget) {
  const sourcePath = mapDistTargetToSource(packageDir, runtimeTarget);
  if (exists(sourcePath)) {
    return parseSourceRuntimeExports(readFileSync(sourcePath, "utf8"));
  }

  const runtimePath = join(packageDir, runtimeTarget.slice(2));
  return parseBuiltRuntimeExports(readFileSync(runtimePath, "utf8"));
}

function assertNoSourceDeclarations(packageDir, packageName) {
  const srcDir = join(packageDir, "src");
  const declarations = collectSourceDeclarations(srcDir);
  if (declarations.length === 0) {
    return;
  }

  throw new Error(
    [
      `Unexpected source declarations in ${packageName}.`,
      "Workspace package declarations belong under types/, not src/.",
      ...declarations.map((path) => `- ${path}`),
    ].join("\n"),
  );
}

function collectSourceDeclarations(dirPath, results = []) {
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectSourceDeclarations(entryPath, results);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".d.ts")) {
      results.push(entryPath);
    }
  }
  return results;
}

function exists(filePath) {
  try {
    readFileSync(filePath, "utf8");
    return true;
  } catch {
    return false;
  }
}

function mapDistTargetToSource(packageDir, runtimeTarget) {
  if (!runtimeTarget.startsWith("./dist/") || !runtimeTarget.endsWith(".js")) {
    throw new Error(`Unsupported runtime export target: ${runtimeTarget}`);
  }
  return join(packageDir, runtimeTarget.replace("./dist/", "src/").replace(/\.js$/, ".ts"));
}

function parseDeclaredRuntimeExports(contents) {
  const exports = new Set();

  for (const match of contents.matchAll(/export\s+declare\s+(?:const|class|function)\s+([A-Za-z0-9_]+)/g)) {
    exports.add(match[1]);
  }

  for (const match of contents.matchAll(/export\s*\{\s*([^}]+)\s*\}\s*from/g)) {
    for (const rawEntry of match[1].split(",")) {
      const entry = rawEntry.trim();
      if (!entry) {
        continue;
      }
      if (entry.startsWith("type ")) {
        continue;
      }
      const aliasParts = entry.split(/\s+as\s+/);
      exports.add((aliasParts[1] ?? aliasParts[0]).trim());
    }
  }

  return [...exports];
}

function parseBuiltRuntimeExports(contents) {
  const exports = new Set();

  for (const match of contents.matchAll(/export\s*\{\s*([^}]+)\s*\};?/g)) {
    for (const rawEntry of match[1].split(",")) {
      const entry = rawEntry.trim();
      if (!entry) {
        continue;
      }
      if (entry.startsWith("type ")) {
        continue;
      }
      const aliasParts = entry.split(/\s+as\s+/);
      exports.add((aliasParts[1] ?? aliasParts[0]).trim());
    }
  }

  return [...exports];
}

function parseSourceRuntimeExports(contents) {
  const exports = new Set();

  for (const match of contents.matchAll(/export\s+(?:const|class|function)\s+([A-Za-z0-9_]+)/g)) {
    exports.add(match[1]);
  }

  for (const match of contents.matchAll(/export(?!\s+type)\s*\{\s*([^}]+)\s*\}\s*(?:from\s+["'][^"']+["'])?;?/g)) {
    for (const rawEntry of match[1].split(",")) {
      const entry = rawEntry.trim();
      if (!entry) {
        continue;
      }
      if (entry.startsWith("type ")) {
        continue;
      }
      const aliasParts = entry.split(/\s+as\s+/);
      exports.add((aliasParts[1] ?? aliasParts[0]).trim());
    }
  }

  return [...exports];
}

function sameMembers(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
