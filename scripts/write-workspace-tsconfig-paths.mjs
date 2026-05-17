import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { readWorkspacePackageExports } from "./workspace-package-exports.mjs";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const rootBaseConfigPath = join(rootDir, "tsconfig.base.json");
const rootBaseStaticConfigPath = join(rootDir, "tsconfig.base.static.json");
const coreConfigPath = join(rootDir, "packages", "core", "tsconfig.workspace-package-types.json");
const checkOnly = process.argv.includes("--check");

writeGeneratedFile(rootBaseConfigPath, buildRootBaseConfig(), checkOnly);
writeGeneratedFile(coreConfigPath, buildCoreWorkspaceTypesConfig(), checkOnly);

function buildRootBaseConfig() {
  const staticConfig = JSON.parse(readFileSync(rootBaseStaticConfigPath, "utf8"));
  const compilerOptions = staticConfig.compilerOptions ?? {};
  const staticPaths = compilerOptions.paths ?? {};

  return {
    compilerOptions: {
      ...compilerOptions,
      paths: {
        ...staticPaths,
        ...buildRootWorkspaceSourcePaths(),
      },
    },
  };
}

function buildCoreWorkspaceTypesConfig() {
  return {
    extends: "../../tsconfig.node.json",
    compilerOptions: {
      noEmit: false,
      emitDeclarationOnly: true,
      declaration: true,
      declarationMap: false,
      rootDir: "./src",
      outDir: "./dist",
      paths: buildCoreWorkspaceTypePaths(),
    },
  };
}

function buildRootWorkspaceSourcePaths() {
  const paths = {};

  for (const workspacePackage of readWorkspacePackageExports(rootDir)) {
    for (const [subpath, target] of Object.entries(workspacePackage.exports)) {
      const defaultTarget =
        typeof target === "string"
          ? target
          : typeof target === "object" && target !== null
            ? target.default
            : null;

      if (typeof defaultTarget !== "string" || !defaultTarget.startsWith("./dist/")) {
        continue;
      }

      const specifier =
        subpath === "." ? workspacePackage.packageName : `${workspacePackage.packageName}/${subpath.slice(2)}`;
      paths[specifier] = [
        join(
          workspacePackage.relativePackageDir,
          defaultTarget.replace("./dist/", "src/").replace(/\.js$/, ".ts"),
        ),
      ];
    }
  }

  return paths;
}

function buildCoreWorkspaceTypePaths() {
  const paths = {};

  for (const workspacePackage of readWorkspacePackageExports(rootDir)) {
    for (const [subpath, target] of Object.entries(workspacePackage.exports)) {
      const typesTarget =
        typeof target === "string"
          ? null
          : typeof target === "object" && target !== null
            ? target.types
            : null;

      if (typeof typesTarget !== "string" || !typesTarget.startsWith("./types/")) {
        continue;
      }

      const specifier =
        subpath === "." ? workspacePackage.packageName : `${workspacePackage.packageName}/${subpath.slice(2)}`;
      paths[specifier] = [join(workspacePackage.relativePackageDir, typesTarget.slice(2))];
    }
  }

  return paths;
}

function writeGeneratedFile(filePath, contents, checkOnly) {
  const next = `${JSON.stringify(contents, null, 2)}\n`;
  if (checkOnly) {
    const current = readFileSync(filePath, "utf8");
    if (current !== next) {
      throw new Error(`Generated config is stale: ${filePath}`);
    }
    return;
  }

  writeFileSync(filePath, next, "utf8");
}
