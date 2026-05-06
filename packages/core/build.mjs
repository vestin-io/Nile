import { spawnSync } from "node:child_process";
import { build } from "esbuild";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));
const srcDir = join(packageDir, "src");
const distDir = join(packageDir, "dist");
const macosHelperTargetVersion = "12.0";

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

buildKeychainHelper();

function readIndexEntries(parentDir) {
  return readdirSync(parentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(parentDir, entry.name, "index.ts"))
    .filter((entry) => existsSync(entry));
}

function unique(values) {
  return [...new Set(values)];
}

function buildKeychainHelper() {
  if (process.platform !== "darwin") {
    return;
  }

  const sourcePath = join(srcDir, "services", "credential", "KeychainGenericPasswordHelper.swift");
  if (!existsSync(sourcePath)) {
    return;
  }

  const outputDir = join(distDir, "services", "credential");
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, "KeychainGenericPasswordHelper");
  const moduleCachePath = join(tmpdir(), "nile-swift-module-cache");
  const arm64OutputPath = join(outputDir, "KeychainGenericPasswordHelper-arm64");
  const x64OutputPath = join(outputDir, "KeychainGenericPasswordHelper-x64");
  mkdirSync(moduleCachePath, { recursive: true });

  compileHelperSlice(sourcePath, arm64OutputPath, `arm64-apple-macos${macosHelperTargetVersion}`, moduleCachePath);
  compileHelperSlice(sourcePath, x64OutputPath, `x86_64-apple-macos${macosHelperTargetVersion}`, moduleCachePath);
  createUniversalHelper(outputPath, [arm64OutputPath, x64OutputPath]);
  rmSync(arm64OutputPath, { force: true });
  rmSync(x64OutputPath, { force: true });
}

function compileHelperSlice(sourcePath, outputPath, target, moduleCachePath) {
  const result = spawnSync("xcrun", ["swiftc", "-O", "-target", target, "-o", outputPath, sourcePath], {
    env: {
      ...process.env,
      CLANG_MODULE_CACHE_PATH: moduleCachePath,
      SWIFT_MODULECACHE_PATH: moduleCachePath,
    },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function createUniversalHelper(outputPath, inputPaths) {
  const result = spawnSync("xcrun", ["lipo", "-create", "-output", outputPath, ...inputPaths], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
