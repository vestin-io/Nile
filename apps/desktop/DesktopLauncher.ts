import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";

type SpawnOptions = {
  entryPath: string;
  stdio?: "inherit" | "pipe";
};

export class DesktopLauncher {
  private static readonly appName = "Nile";
  private static readonly macHostName = "Nile.app";

  constructor(private readonly root: string) {}

  async launch(options: SpawnOptions): Promise<ChildProcess> {
    const executablePath = this.resolveExecutablePath();
    return spawn(executablePath, [options.entryPath], {
      cwd: this.root,
      stdio: options.stdio ?? "inherit",
    });
  }

  async run(entryPath: string): Promise<number | null> {
    const process = await this.launch({ entryPath });
    return await new Promise<number | null>((resolve) => {
      process.once("exit", (code) => resolve(code));
    });
  }

  private resolveExecutablePath(): string {
    if (process.platform !== "darwin") {
      return join(this.root, "node_modules", ".bin", "electron");
    }

    return this.prepareMacHost();
  }

  private prepareMacHost(): string {
    const sourceAppPath = join(
      this.root,
      "node_modules",
      "electron",
      "dist",
      "Electron.app",
    );
    const targetRoot = join(this.root, ".runtime", "host");
    const targetAppPath = join(targetRoot, DesktopLauncher.macHostName);
    const plistPath = join(targetAppPath, "Contents", "Info.plist");
    const targetIconPath = join(targetAppPath, "Contents", "Resources", "electron.icns");

    rmSync(targetAppPath, { recursive: true, force: true });
    mkdirSync(targetRoot, { recursive: true });
    cpSync(sourceAppPath, targetAppPath, {
      recursive: true,
      verbatimSymlinks: true,
    });

    const infoPlist = readFileSync(plistPath, "utf8");
    writeFileSync(plistPath, DesktopLauncher.rewriteInfoPlist(infoPlist), "utf8");
    this.copyMacHostIcon(targetIconPath);

    return join(targetAppPath, "Contents", "MacOS", "Electron");
  }

  private copyMacHostIcon(targetIconPath: string): void {
    const sourceIconPath = join(this.root, "build", "icons", "icon.icns");
    if (!existsSync(sourceIconPath)) {
      return;
    }

    cpSync(sourceIconPath, targetIconPath);
  }

  static rewriteInfoPlist(infoPlist: string): string {
    let next = infoPlist;
    next = DesktopLauncher.replacePlistString(next, "CFBundleDisplayName", DesktopLauncher.appName);
    next = DesktopLauncher.replacePlistString(next, "CFBundleName", DesktopLauncher.appName);
    next = DesktopLauncher.replacePlistString(next, "CFBundleIdentifier", "com.nile.desktop.dev");
    return next;
  }

  private static replacePlistString(infoPlist: string, key: string, value: string): string {
    const pattern = new RegExp(`(<key>${key}</key>\\s*<string>)([^<]*)(</string>)`);
    if (!pattern.test(infoPlist)) {
      throw new Error(`Missing ${key} in Electron host Info.plist`);
    }

    return infoPlist.replace(pattern, `$1${value}$3`);
  }
}
