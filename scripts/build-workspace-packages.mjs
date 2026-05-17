import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { readWorkspacePackageExports } from "./workspace-package-exports.mjs";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

for (const workspacePackage of readWorkspacePackageExports(rootDir)) {
  const result = spawnSync("npm", ["run", "build", "-w", workspacePackage.packageName], {
    cwd: rootDir,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const verify = spawnSync("node", ["./scripts/verify-workspace-package-contracts.mjs"], {
  cwd: rootDir,
  stdio: "inherit",
});

if (verify.status !== 0) {
  process.exit(verify.status ?? 1);
}
