import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DesktopLauncher } from "./DesktopLauncher";

const root = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(root, "src");
const iconRoot = join(root, "build", "icons");
const sharedIconPath = join(root, "..", "..", "assets", "icons", "nile-mark.svg");

class DesktopDevServer {
  private electronProcess: ChildProcess | null = null;
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  private watchTimer: ReturnType<typeof setInterval> | null = null;
  private rebuilding = false;
  private pendingRebuild = false;
  private stopping = false;
  private previousSnapshot = new Map<string, number>();
  private readonly launcher = new DesktopLauncher(root);
  private readonly watchedPaths = [srcRoot, iconRoot, sharedIconPath];

  async start(): Promise<void> {
    await this.build();
    await this.startElectron();
    this.previousSnapshot = this.createSnapshot();
    this.startPolling();
    console.log("[desktop] watching for changes...");
  }

  async stop(): Promise<void> {
    if (this.stopping) {
      return;
    }

    this.stopping = true;
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
      this.rebuildTimer = null;
    }
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
    await this.stopElectron();
  }

  private startPolling(): void {
    this.watchTimer = setInterval(() => {
      const nextSnapshot = this.createSnapshot();
      if (!this.hasSnapshotChanged(nextSnapshot)) {
        return;
      }
      this.previousSnapshot = nextSnapshot;
      this.scheduleRebuild();
    }, 500);
  }

  private scheduleRebuild(): void {
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
    }
    this.rebuildTimer = setTimeout(() => {
      this.rebuildTimer = null;
      void this.rebuildAndRestart();
    }, 150);
  }

  private async rebuildAndRestart(): Promise<void> {
    if (this.rebuilding) {
      this.pendingRebuild = true;
      return;
    }

    this.rebuilding = true;
    try {
      console.log("[desktop] rebuilding...");
      await this.build();
      console.log("[desktop] restarting Electron...");
      await this.stopElectron();
      await this.startElectron();
    } catch (error) {
      console.error("[desktop] rebuild failed");
      console.error(error);
    } finally {
      this.rebuilding = false;
      if (this.pendingRebuild) {
        this.pendingRebuild = false;
        void this.rebuildAndRestart();
      }
    }
  }

  private async build(): Promise<void> {
    await this.runOrThrow(["node", "--import", "tsx", "./build.ts"]);
  }

  private async startElectron(): Promise<void> {
    this.electronProcess = await this.launcher.launch({
      entryPath: "./dist/electron/main.cjs",
      stdio: "inherit",
    });
  }

  private async stopElectron(): Promise<void> {
    if (!this.electronProcess) {
      return;
    }

    const process = this.electronProcess;
    this.electronProcess = null;
    if (process.exitCode !== null) {
      return;
    }

    process.kill();
    await new Promise<void>((resolve) => {
      process.once("exit", () => resolve());
    });
  }

  private async runOrThrow(cmd: string[]): Promise<void> {
    const process = spawn(cmd[0], cmd.slice(1), {
      cwd: root,
      stdio: "inherit",
    });
    const exitCode = await new Promise<number | null>((resolve) => {
      process.once("exit", (code) => resolve(code));
    });
    if (exitCode !== 0) {
      throw new Error(`Command failed: ${cmd.join(" ")}`);
    }
  }

  private createSnapshot(): Map<string, number> {
    const snapshot = new Map<string, number>();
    for (const targetPath of this.watchedPaths) {
      this.collectSnapshotEntries(targetPath, snapshot);
    }
    return snapshot;
  }

  private collectSnapshotEntries(targetPath: string, snapshot: Map<string, number>): void {
    if (!existsSync(targetPath)) {
      return;
    }

    const stats = statSync(targetPath);
    if (stats.isDirectory()) {
      for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
        this.collectSnapshotEntries(join(targetPath, entry.name), snapshot);
      }
      return;
    }

    snapshot.set(targetPath, stats.mtimeMs);
  }

  private hasSnapshotChanged(nextSnapshot: Map<string, number>): boolean {
    if (nextSnapshot.size !== this.previousSnapshot.size) {
      return true;
    }

    for (const [path, mtime] of nextSnapshot) {
      if (this.previousSnapshot.get(path) !== mtime) {
        return true;
      }
    }

    return false;
  }
}

const server = new DesktopDevServer();

process.once("SIGINT", async () => {
  console.log("\n[desktop] stopping...");
  await server.stop();
  process.exit(0);
});

process.once("SIGTERM", async () => {
  console.log("\n[desktop] stopping...");
  await server.stop();
  process.exit(0);
});

await server.start();
