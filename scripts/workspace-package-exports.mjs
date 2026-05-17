import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const WORKSPACE_PACKAGE_DIRS = ["packages/agents", "packages/connections", "packages/builtins"];

export function readWorkspacePackageExports(rootDir, relativeDirs = WORKSPACE_PACKAGE_DIRS) {
  return relativeDirs.flatMap((relativeDir) => readWorkspaceGroupPackageExports(rootDir, relativeDir));
}

export function buildWorkspaceDistAliases(rootDir, relativeDirs = WORKSPACE_PACKAGE_DIRS) {
  const aliases = {};
  for (const workspacePackage of readWorkspacePackageExports(rootDir, relativeDirs)) {
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
        subpath === "."
          ? workspacePackage.packageName
          : `${workspacePackage.packageName}/${subpath.slice(2)}`;
      aliases[specifier] = join(workspacePackage.packageDir, defaultTarget.slice(2));
    }
  }

  return aliases;
}

function readWorkspaceGroupPackageExports(rootDir, relativeDir) {
  const packagesDir = join(rootDir, relativeDir);
  if (!existsSync(packagesDir)) {
    return [];
  }

  const directPackageJsonPath = join(packagesDir, "package.json");
  if (existsSync(directPackageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(directPackageJsonPath, "utf8"));
    return [{
      packageDir: packagesDir,
      relativePackageDir: relativeDir,
      packageName: packageJson.name,
      exports: packageJson.exports ?? {},
    }];
  }

  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const relativePackageDir = join(relativeDir, entry.name);
      const packageDir = join(rootDir, relativePackageDir);
      const packageJson = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
      return {
        packageDir,
        relativePackageDir,
        packageName: packageJson.name,
        exports: packageJson.exports ?? {},
      };
    });
}
