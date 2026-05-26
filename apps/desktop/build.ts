import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import autoprefixer from "autoprefixer";
import { build as esbuild } from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

class DesktopBuilder {
  private readonly root = dirname(fileURLToPath(import.meta.url));
  private readonly src = join(this.root, "src");
  private readonly dist = join(this.root, "dist");
  private readonly repoRoot = join(this.root, "..", "..");

  constructor(private readonly isReleaseBuild: boolean) {}

  async run(): Promise<void> {
    rmSync(this.dist, { recursive: true, force: true });
    await this.buildEntry(join(this.src, "electron", "main.ts"), join(this.dist, "electron", "main.cjs"), "node");
    await this.buildEntry(join(this.src, "electron", "preload.ts"), join(this.dist, "electron", "preload.cjs"), "node");
    await this.buildEntry(join(this.src, "renderer", "app", "menubar.ts"), join(this.dist, "renderer", "menubar.js"), "browser");
    await this.buildEntry(join(this.src, "renderer", "app", "settings.tsx"), join(this.dist, "renderer", "settings.js"), "browser");
    this.copyCoreKeychainHelper(join(this.dist, "electron", "KeychainGenericPasswordHelper"));

    this.copyAsset(join(this.src, "renderer", "app", "menubar.html"), join(this.dist, "renderer", "menubar.html"));
    this.copyAsset(join(this.src, "renderer", "app", "settings.html"), join(this.dist, "renderer", "settings.html"));
    await this.buildCss(join(this.src, "renderer", "app", "styles.css"), join(this.dist, "renderer", "styles.css"));
  }

  private async buildEntry(entrypoint: string, outfile: string, target: "node" | "browser"): Promise<void> {
    mkdirSync(dirname(outfile), { recursive: true });

    await esbuild({
      entryPoints: [entrypoint],
      outfile,
      tsconfig: join(this.repoRoot, "tsconfig.base.json"),
      platform: target === "node" ? "node" : "browser",
      bundle: true,
      format: target === "node" ? "cjs" : "esm",
      sourcemap: !this.isReleaseBuild,
      external: target === "node" ? ["electron"] : [],
      loader: {
        ".svg": "text",
        ".png": "dataurl",
      },
      jsx: "automatic",
      legalComments: "none",
      logLevel: "silent",
      minify: this.isReleaseBuild,
    });
  }

  private async buildCss(inputPath: string, outputPath: string): Promise<void> {
    mkdirSync(dirname(outputPath), { recursive: true });
    const source = readFileSync(inputPath, "utf8");
    const result = await postcss([
      tailwindcss({ config: join(this.root, "tailwind.config.cjs") }),
      autoprefixer(),
    ]).process(source, {
      from: inputPath,
      to: outputPath,
    });
    writeFileSync(outputPath, result.css, "utf8");
  }

  private copyAsset(from: string, to: string): void {
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to);
  }

  private copyCoreKeychainHelper(targetPath: string): void {
    const helperPath = join(this.root, "..", "..", "packages", "core", "dist", "services", "credential", "KeychainGenericPasswordHelper");
    if (!existsSync(helperPath)) {
      return;
    }

    this.copyAsset(helperPath, targetPath);
  }
}

const isReleaseBuild = process.argv.includes("--release") || process.env.NILE_BUILD_RELEASE === "1";

await new DesktopBuilder(isReleaseBuild).run();
