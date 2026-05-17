import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

import { readWorkspacePackageExports } from "./scripts/workspace-package-exports.mjs";

const rootDir = dirname(fileURLToPath(import.meta.url));
const coreSrcDir = join(rootDir, "packages", "core", "src");
const hostLocalSrcDir = join(rootDir, "packages", "host-local", "src");

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@nile\/core$/, replacement: join(coreSrcDir, "index.ts") },
      {
        find: /^@nile\/core\/models\/connection\/enabled-agents-policy$/,
        replacement: join(coreSrcDir, "models", "connection", "EnabledAgentsPolicy.ts"),
      },
      {
        find: /^@nile\/core\/models\/connection\/requirements$/,
        replacement: join(coreSrcDir, "models", "connection", "Requirements.ts"),
      },
      {
        find: /^@nile\/core\/models\/agent\/capabilities$/,
        replacement: join(coreSrcDir, "models", "agent", "registry", "Capabilities.ts"),
      },
      {
        find: /^@nile\/core\/models\/agent\/ids$/,
        replacement: join(coreSrcDir, "models", "agent", "Ids.ts"),
      },
      {
        find: /^@nile\/core\/models\/agent\/module$/,
        replacement: join(coreSrcDir, "models", "agent", "module", "index.ts"),
      },
      ...buildWorkspaceSourceAliases(),
      { find: /^@nile\/core\/(.+)$/, replacement: `${coreSrcDir}/$1` },
      { find: /^@nile\/host-local$/, replacement: join(hostLocalSrcDir, "index.ts") },
      { find: /^@nile\/host-local\/(.+)$/, replacement: `${hostLocalSrcDir}/$1` },
    ],
  },
  test: {
    environment: "node",
    setupFiles: ["./packages/builtins/src/setup.ts"],
    include: [
      "packages/core/src/**/*.test.ts",
      "packages/agents/*/src/**/*.test.ts",
      "packages/builtins/src/**/*.test.ts",
      "packages/connections/src/**/*.test.ts",
      "packages/host-local/src/**/*.test.ts",
      "apps/cli/src/**/*.test.ts",
      "apps/desktop/src/**/*.test.ts",
    ],
  },
});

function buildWorkspaceSourceAliases() {
  return readWorkspacePackageExports(rootDir).flatMap((workspacePackage) =>
    Object.entries(workspacePackage.exports).flatMap(([subpath, target]) => {
      const defaultTarget =
        typeof target === "string"
          ? target
          : typeof target === "object" && target !== null
            ? target.default
            : null;

      if (typeof defaultTarget !== "string" || !defaultTarget.startsWith("./dist/")) {
        return [];
      }

      const specifier =
        subpath === "." ? workspacePackage.packageName : `${workspacePackage.packageName}/${subpath.slice(2)}`;
      const replacement = join(
        rootDir,
        workspacePackage.relativePackageDir,
        defaultTarget.replace("./dist/", "src/").replace(/\.js$/, ".ts"),
      );

      return [{ find: new RegExp(`^${escapeForRegex(specifier)}$`), replacement }];
    }),
  );
}

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
