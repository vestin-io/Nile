import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

class DesktopPackager {
  private static readonly MAS_SIGNING_IDENTITY =
    "Vestin Limited";
  private static readonly MAS_APPLICATION_IDENTIFIER = "6N2P2T69SK.io.vestin.nile";
  private static readonly MAC_ARCHITECTURE_FLAGS = ["--x64", "--arm64", "--universal"] as const;
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
    if (process.argv.includes("--mas")) {
      args.push("--mac", "mas");
      args.push(...this.readMasArchitectureArgs());
      args.push(
        `-c.mac.identity=${this.readMasSigningIdentity()}`,
        `-c.mas.provisioningProfile=${this.readMasProvisioningProfilePath()}`,
      );
    }
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

  private readMasArchitectureArgs(): string[] {
    const configuredFlags = DesktopPackager.MAC_ARCHITECTURE_FLAGS.filter((flag) =>
      process.argv.includes(flag),
    );
    if (configuredFlags.length > 1) {
      throw new Error(
        `Only one MAS architecture flag may be used at a time: ${DesktopPackager.MAC_ARCHITECTURE_FLAGS.join(", ")}`,
      );
    }

    return [configuredFlags[0] ?? "--universal"];
  }

  private readEnvironment(): NodeJS.ProcessEnv {
    if (process.argv.includes("--mas")) {
      return {
        ...process.env,
        CSC_IDENTITY_AUTO_DISCOVERY: "false",
        CSC_NAME: this.readMasSigningIdentity(),
      };
    }

    if (!process.argv.includes("--unsigned")) {
      return process.env;
    }

    return {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: "false",
    };
  }

  private readMasSigningIdentity(): string {
    return process.env.NILE_DESKTOP_MAS_SIGNING_IDENTITY ?? DesktopPackager.MAS_SIGNING_IDENTITY;
  }

  private readMasProvisioningProfilePath(): string {
    const configuredPath = process.env.NILE_DESKTOP_MAS_PROVISIONING_PROFILE;
    if (configuredPath?.trim()) {
      return configuredPath;
    }

    for (const directory of this.readMasProvisioningProfileDirectories()) {
      if (!existsSync(directory)) {
        continue;
      }
      for (const fileName of readdirSync(directory)) {
        if (!fileName.endsWith(".provisionprofile") && !fileName.endsWith(".mobileprovision")) {
          continue;
        }
        const profilePath = join(directory, fileName);
        if (this.isMatchingMasProvisioningProfile(profilePath)) {
          return profilePath;
        }
      }
    }

    throw new Error(
      "Unable to find a Mac App Store provisioning profile for io.vestin.nile. Set NILE_DESKTOP_MAS_PROVISIONING_PROFILE to the downloaded profile path.",
    );
  }

  private readMasProvisioningProfileDirectories(): string[] {
    const home = homedir();
    return [
      join(home, "Library", "MobileDevice", "Provisioning Profiles"),
      join(home, "Downloads"),
    ];
  }

  private isMatchingMasProvisioningProfile(profilePath: string): boolean {
    const result = spawnSync("security", ["cms", "-D", "-i", profilePath], {
      encoding: "utf8",
    });
    if (result.status !== 0 || !result.stdout) {
      return false;
    }

    return result.stdout.includes(DesktopPackager.MAS_APPLICATION_IDENTIFIER);
  }
}

new DesktopPackager().run();
