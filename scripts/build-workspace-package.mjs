import { build } from "esbuild";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const packageDir = process.cwd();
const packageJsonPath = join(packageDir, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const srcDir = join(packageDir, "src");
const distDir = join(packageDir, "dist");

rmSync(distDir, { recursive: true, force: true });
removeGeneratedSourceDeclarations(srcDir);

const entryPoints = unique([
  ...readExportEntries(packageJson.exports ?? {}),
  mapDistTargetToSource(packageJson.main),
].filter((entry) => typeof entry === "string" && existsSync(entry)));

await build({
  entryPoints,
  outbase: srcDir,
  outdir: distDir,
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "node",
  target: "node20",
  packages: "external",
  logLevel: "info",
  sourcemap: false,
});

validateExportArtifacts(packageJson);

function readExportEntries(exportsField) {
  return Object.values(exportsField)
    .map((target) => {
      if (typeof target === "string") {
        return mapDistTargetToSource(target);
      }
      if (typeof target === "object" && target !== null && typeof target.default === "string") {
        return mapDistTargetToSource(target.default);
      }
      return null;
    })
    .filter(Boolean);
}

function mapDistTargetToSource(target) {
  if (typeof target !== "string" || !target.startsWith("./dist/") || !target.endsWith(".js")) {
    return null;
  }

  return join(packageDir, target.replace("./dist/", "src/").replace(/\.js$/, ".ts"));
}

function validateExportArtifacts(packageJson) {
  for (const [subpath, target] of Object.entries(packageJson.exports ?? {})) {
    const defaultTarget =
      typeof target === "string"
        ? target
        : typeof target === "object" && target !== null
          ? target.default
          : null;

    if (typeof defaultTarget !== "string" || !defaultTarget.startsWith("./dist/")) {
      continue;
    }

    const artifactPath = join(packageDir, defaultTarget.slice(2));
    if (!existsSync(artifactPath)) {
      throw new Error(`Missing built artifact for export ${subpath}: ${defaultTarget}`);
    }
  }
}

function unique(values) {
  return [...new Set(values)];
}

function removeGeneratedSourceDeclarations(dir) {
  if (!existsSync(dir)) {
    return;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      removeGeneratedSourceDeclarations(entryPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".d.ts")) {
      rmSync(entryPath, { force: true });
    }
  }
}
