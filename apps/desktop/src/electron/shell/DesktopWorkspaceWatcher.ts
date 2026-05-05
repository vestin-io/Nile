import { watch, type FSWatcher } from "node:fs";
import { basename, dirname } from "node:path";

import type { NileLogger } from "@nile/core/services/NileLogger";

type DesktopWorkspaceWatcherOptions = {
  databasePath: string;
  logger: NileLogger;
  onRelevantChange(): void;
};

export class DesktopWorkspaceWatcher {
  private watcher: FSWatcher | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private ignoreChangesUntil = 0;

  constructor(private readonly options: DesktopWorkspaceWatcherOptions) {}

  start(): void {
    const workspaceDir = dirname(this.options.databasePath);
    try {
      this.watcher = watch(workspaceDir, (_eventType, filename) => {
        if (!this.isRelevantWorkspaceChange(filename)) {
          return;
        }
        this.scheduleRefresh();
      });
      this.watcher.on("error", (error) => {
        this.options.logger.warn("desktop.workspace_watch_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    } catch (error) {
      this.options.logger.warn("desktop.workspace_watch_start_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  ignoreChangesFor(durationMs: number): void {
    this.ignoreChangesUntil = Date.now() + durationMs;
  }

  private isRelevantWorkspaceChange(filename: string | Buffer | null): boolean {
    if (!filename) {
      return true;
    }

    const workspaceFile = filename.toString();
    const databaseFile = basename(this.options.databasePath);
    return workspaceFile === databaseFile
      || workspaceFile === `${databaseFile}-wal`
      || workspaceFile === `${databaseFile}-shm`;
  }

  private scheduleRefresh(): void {
    if (Date.now() < this.ignoreChangesUntil) {
      return;
    }

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.options.onRelevantChange();
    }, 250);
  }
}
