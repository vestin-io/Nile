import { build } from "esbuild";
import { dirname, join } from "node:path";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));
const distDir = join(packageDir, "dist");

rmSync(distDir, { recursive: true, force: true });

await build({
  entryPoints: [join(packageDir, "src", "index.ts")],
  outfile: join(distDir, "index.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  packages: "external",
  logLevel: "info",
  sourcemap: false,
});
