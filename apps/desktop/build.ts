import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import autoprefixer from "autoprefixer";
import { build as esbuild } from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "src");
const dist = join(root, "dist");
const isReleaseBuild = process.env.NILE_BUILD_RELEASE === "1";

async function build(): Promise<void> {
  rmSync(dist, { recursive: true, force: true });
  await buildEntry(join(src, "electron", "main.ts"), join(dist, "electron", "main.cjs"), "node");
  await buildEntry(join(src, "electron", "preload.ts"), join(dist, "electron", "preload.cjs"), "node");
  await buildEntry(join(src, "renderer", "app", "menubar.ts"), join(dist, "renderer", "menubar.js"), "browser");
  await buildEntry(join(src, "renderer", "app", "settings.tsx"), join(dist, "renderer", "settings.js"), "browser");

  copyAsset(join(src, "renderer", "app", "menubar.html"), join(dist, "renderer", "menubar.html"));
  copyAsset(join(src, "renderer", "app", "settings.html"), join(dist, "renderer", "settings.html"));
  await buildCss(join(src, "renderer", "app", "styles.css"), join(dist, "renderer", "styles.css"));
}

async function buildEntry(entrypoint: string, outfile: string, target: "node" | "browser"): Promise<void> {
  mkdirSync(dirname(outfile), { recursive: true });

  await esbuild({
    entryPoints: [entrypoint],
    outfile,
    platform: target === "node" ? "node" : "browser",
    bundle: true,
    format: target === "node" ? "cjs" : "esm",
    sourcemap: !isReleaseBuild,
    external: target === "node" ? ["electron"] : [],
    loader: {
      ".svg": "text",
      ".png": "dataurl",
    },
    jsx: "automatic",
    legalComments: "none",
    logLevel: "silent",
    minify: isReleaseBuild,
  });
}

async function buildCss(inputPath: string, outputPath: string): Promise<void> {
  mkdirSync(dirname(outputPath), { recursive: true });
  const source = readFileSync(inputPath, "utf8");
  const result = await postcss([
    tailwindcss({ config: join(root, "tailwind.config.cjs") }),
    autoprefixer(),
  ]).process(source, {
    from: inputPath,
    to: outputPath,
  });
  writeFileSync(outputPath, result.css, "utf8");
}

function copyAsset(from: string, to: string): void {
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
}

await build();
