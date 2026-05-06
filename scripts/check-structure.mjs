import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_ROOTS = ["apps", "packages"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const EXCLUDED_DIRS = new Set(["node_modules", "dist", ".runtime", "release"]);
const ALLOWED_RUNTIME_LOCAL_IMPORTS = new Set(["NileSession", "runWithSession", "runWithSessionAsync"]);

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

function checkRuntimeLocalExports() {
  const runtimeIndexPath = path.join(ROOT, "packages/core/src/runtime-local/index.ts");
  const exportLines = read(runtimeIndexPath)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("export * from "));
  const expected = [
    'export * from "./NileSession";',
    'export * from "./SessionWork";',
  ];
  if (exportLines.length !== expected.length || exportLines.some((line, index) => line !== expected[index])) {
    violations.push(
      `packages/core/src/runtime-local/index.ts must export only NileSession and SessionWork; found: ${exportLines.join(", ")}`,
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
      const names = parseNamedImports(statement);
      if (!names) {
        violations.push(`${repoPath} uses a non-named import from @nile/core/runtime-local`);
        continue;
      }
      for (const name of names) {
        if (!ALLOWED_RUNTIME_LOCAL_IMPORTS.has(name)) {
          violations.push(
            `${repoPath} imports ${name} from @nile/core/runtime-local; import it from its real owning module instead`,
          );
        }
      }
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
checkRuntimeLocalExports();
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
