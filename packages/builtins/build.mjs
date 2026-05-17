import { build } from "esbuild";
import { dirname, join } from "node:path";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));
const distDir = join(packageDir, "dist");

rmSync(distDir, { recursive: true, force: true });

await build({
  entryPoints: [
    join(packageDir, "src", "index.ts"),
    join(packageDir, "src", "agents", "index.ts"),
    join(packageDir, "src", "connections", "index.ts"),
    join(packageDir, "src", "cursor-usage", "index.ts"),
    join(packageDir, "src", "local", "index.ts"),
    join(packageDir, "src", "runtime", "index.ts"),
    join(packageDir, "src", "session", "index.ts"),
  ],
  outbase: join(packageDir, "src"),
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
