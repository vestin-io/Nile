import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

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
      { find: /^@nile\/core\/(.+)$/, replacement: `${coreSrcDir}/$1` },
      { find: /^@nile\/host-local$/, replacement: join(hostLocalSrcDir, "index.ts") },
      { find: /^@nile\/host-local\/(.+)$/, replacement: `${hostLocalSrcDir}/$1` },
    ],
  },
  test: {
    environment: "node",
    include: [
      "packages/core/src/**/*.test.ts",
      "packages/host-local/src/**/*.test.ts",
      "apps/cli/src/**/*.test.ts",
      "apps/desktop/src/**/*.test.ts",
    ],
  },
});
