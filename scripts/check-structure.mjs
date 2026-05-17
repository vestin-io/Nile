import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_ROOTS = ["apps", "packages"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const EXCLUDED_DIRS = new Set(["node_modules", "dist", ".runtime", "release"]);
const violations = [];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function toRepoPath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function read(filePath) {
  return readFileSync(filePath, "utf8");
}

function isTestFile(filePath) {
  return /\.test\.(ts|tsx)$/.test(filePath);
}

function checkLineLimits(files) {
  for (const filePath of files) {
    if (isTestFile(filePath) || filePath.endsWith(".d.ts")) {
      continue;
    }
    const lineCount = read(filePath).split("\n").length;
    if (lineCount > 500) {
      violations.push(`${toRepoPath(filePath)} exceeds 500 lines (${lineCount})`);
    }
  }
}

function checkBuiltinsRuntimeExports() {
  const runtimeIndexPath = path.join(ROOT, "packages/builtins/src/runtime/index.ts");
  const runtimeExports = parseSourceRuntimeExports(read(runtimeIndexPath)).sort();
  const expected = ["NileSession", "runWithSession", "runWithSessionAsync"];
  if (runtimeExports.length !== expected.length || runtimeExports.some((name, index) => name !== expected[index])) {
    violations.push(
      `packages/builtins/src/runtime/index.ts must export only NileSession, runWithSession, and runWithSessionAsync; found: ${runtimeExports.join(", ")}`,
    );
  }
}

function checkApplicationLocalExports() {
  const applicationIndexPath = path.join(ROOT, "packages/core/src/application/local/index.ts");
  const lines = read(applicationIndexPath).split("\n").map((line) => line.trim());
  const blockedValueExports = new Set([
    "./AgentWorkflows",
    "./ConnectionWorkflows",
    "./WorkspaceState",
    "./CursorUsageAutoBinder",
  ]);
  for (const line of lines) {
    if (!line.startsWith("export")) {
      continue;
    }
    const sourceMatch = line.match(/from\s+["']([^"']+)["']/);
    const source = sourceMatch?.[1];
    if (!source || !blockedValueExports.has(source)) {
      continue;
    }
    if (line.startsWith("export type ")) {
      continue;
    }
    violations.push(
      `packages/core/src/application/local/index.ts must not value-export ${source}; keep internal workflows and workspace resources out of the public surface`,
    );
  }
}

function parseNamedImports(statement) {
  const match = statement.match(/\{([\s\S]*?)\}/);
  if (!match) {
    return null;
  }
  return match[1]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((name) => name.replace(/^type\s+/, "").split(/\s+as\s+/)[0]?.trim())
    .filter(Boolean);
}

function parseSourceRuntimeExports(contents) {
  const exports = new Set();

  for (const match of contents.matchAll(/export\s+(?:const|class|function)\s+([A-Za-z0-9_]+)/g)) {
    exports.add(match[1]);
  }

  for (const match of contents.matchAll(/export(?!\s+type)\s*\{\s*([^}]+)\s*\}\s*(?:from\s+["'][^"']+["'])?;?/g)) {
    for (const rawEntry of match[1].split(",")) {
      const entry = rawEntry.trim();
      if (!entry || entry.startsWith("type ")) {
        continue;
      }
      const aliasParts = entry.split(/\s+as\s+/);
      exports.add((aliasParts[1] ?? aliasParts[0]).trim());
    }
  }

  return [...exports];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findImportStatements(content, source) {
  const pattern = new RegExp(
    `import\\s+(?:type\\s+)?(?:\\{[^;]*?\\}|[^;\\n]+)\\s+from\\s+["']${escapeRegExp(source)}["'];?`,
    "g",
  );
  return content.match(pattern) ?? [];
}

function checkRuntimeLocalImports(files) {
  for (const filePath of files) {
    const repoPath = toRepoPath(filePath);
    const content = read(filePath);
    const statements = findImportStatements(content, "@nile/core/runtime-local");
    for (const statement of statements) {
      violations.push(
        `${repoPath} imports from @nile/core/runtime-local; use @nile/builtins/runtime for concrete session runtime or a narrow runtime-local subpath instead`,
      );
    }
  }
}

function checkConnectionSetupImports(files) {
  for (const filePath of files) {
    const repoPath = toRepoPath(filePath);
    if (repoPath.startsWith("packages/core/src/models/connection/")) {
      continue;
    }
    const content = read(filePath);
    const statements = content.match(/import[\s\S]*?from\s+["'][^"']+["'];?/g) ?? [];
    for (const statement of statements) {
      const sourceMatch = statement.match(/from\s+["']([^"']+)["']/);
      const source = sourceMatch?.[1] ?? "";
      if (source.includes("connection/setup/")) {
        violations.push(
          `${repoPath} imports ${source}; use the models/connection root export instead of the setup internal cluster`,
        );
      }
    }
  }
}

const files = SOURCE_ROOTS.flatMap((root) => walk(path.join(ROOT, root)));

checkLineLimits(files);
checkBuiltinsRuntimeExports();
checkApplicationLocalExports();
checkRuntimeLocalImports(files);
checkConnectionSetupImports(files);

if (violations.length > 0) {
  console.error("Structure check failed:\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Structure check passed.");
