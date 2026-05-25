import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

class DesktopPackager {
  private readonly root = dirname(fileURLToPath(import.meta.url));
  private readonly require = createRequire(import.meta.url);
  private readonly electronBuilderCli = this.require.resolve("electron-builder/cli.js");

  run(): void {
    const result = spawnSync(process.execPath, [this.electronBuilderCli, ...this.readBuilderArgs()], {
      cwd: this.root,
      env: this.readEnvironment(),
      stdio: "inherit",
    });

    if (result.error) {
      throw result.error;
    }

    if (typeof result.status === "number" && result.status !== 0) {
      process.exit(result.status);
    }
  }

  private readBuilderArgs(): string[] {
    const args = ["--publish", "never"];
    if (process.argv.includes("--dir")) {
      args.push("--dir");
    }
    if (process.argv.includes("--unsigned") && process.platform === "darwin") {
      args.push("-c.mac.identity=null");
    }
    if (process.argv.includes("--unsigned") && process.platform === "win32") {
      args.push("-c.win.signAndEditExecutable=false");
    }
    return args;
  }

  private readEnvironment(): NodeJS.ProcessEnv {
    if (!process.argv.includes("--unsigned")) {
      return process.env;
    }

    return {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: "false",
    };
  }
}

new DesktopPackager().run();
