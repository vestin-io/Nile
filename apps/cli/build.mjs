import { build } from "esbuild";
import { chmodSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));
const distDir = join(packageDir, "dist");
const outputPath = join(distDir, "main.js");
const repoRoot = join(packageDir, "..", "..");

rmSync(distDir, { recursive: true, force: true });

await build({
  entryPoints: [join(packageDir, "src", "main.ts")],
  outfile: outputPath,
  tsconfig: join(repoRoot, "tsconfig.base.json"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  packages: "external",
  banner: {
    js: "#!/usr/bin/env node",
  },
  logLevel: "info",
  sourcemap: false,
});

chmodSync(outputPath, 0o755);
