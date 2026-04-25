import { defineConfig } from "vitest/config";

export default defineConfig({
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
