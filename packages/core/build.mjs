import { build } from "esbuild";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));
const srcDir = join(packageDir, "src");
const distDir = join(packageDir, "dist");

rmSync(distDir, { recursive: true, force: true });

const entryPoints = unique([
  join(srcDir, "index.ts"),
  join(srcDir, "application", "index.ts"),
  join(srcDir, "application", "local", "index.ts"),
  join(srcDir, "models", "agent", "index.ts"),
  join(srcDir, "models", "agent", "Homes.ts"),
  join(srcDir, "models", "agent", "Types.ts"),
  join(srcDir, "models", "connection", "EnabledAgentsPolicy.ts"),
  join(srcDir, "projection", "index.ts"),
  join(srcDir, "runtime-local", "index.ts"),
  join(srcDir, "usage", "cursor.ts"),
  join(srcDir, "services", "EnvironmentSource.ts"),
  join(srcDir, "services", "NileLogger.ts"),
  join(srcDir, "agents", "index.ts"),
  ...readIndexEntries(join(srcDir, "models")),
  ...readIndexEntries(join(srcDir, "services")),
]);

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

function readIndexEntries(parentDir) {
  return readdirSync(parentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(parentDir, entry.name, "index.ts"))
    .filter((entry) => existsSync(entry));
}

function unique(values) {
  return [...new Set(values)];
}
