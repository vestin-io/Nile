import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { readWorkspacePackageExports } from "./workspace-package-exports.mjs";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

for (const workspacePackage of readWorkspacePackageExports(rootDir)) {
  const result = runCommand("npm", ["run", "build", "-w", workspacePackage.packageName]);

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const verify = runCommand("node", ["./scripts/verify-workspace-package-contracts.mjs"]);

if (verify.error) {
  throw verify.error;
}

if (verify.status !== 0) {
  process.exit(verify.status ?? 1);
}

function runCommand(command, args) {
  if (process.platform === "win32") {
    return spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command, ...args], {
      cwd: rootDir,
      stdio: "inherit",
    });
  }

  return spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
  });
}
