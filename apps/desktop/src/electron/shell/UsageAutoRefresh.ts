import type { NileLogger } from "@nile/core/services/NileLogger";

import { DesktopUsageCache } from "../../state/UsageCache";

type DesktopUsageAutoRefreshOptions = {
  logger: NileLogger;
  refreshAutomaticUsage(options: {
    fallbackToDesktopRefresh?: boolean;
    force?: boolean;
  }): Promise<void>;
};

export class DesktopUsageAutoRefresh {
  private static readonly STARTUP_REFRESH_DELAY_MS = 1_500;

  private startupTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private refresh: Promise<void> | null = null;

  constructor(private readonly options: DesktopUsageAutoRefreshOptions) {}

  start(): void {
    if (this.startupTimeoutHandle !== null || this.intervalHandle !== null) {
      return;
    }

    this.startupTimeoutHandle = setTimeout(() => {
      this.startupTimeoutHandle = null;
      void this.refreshUsage({
        failureEvent: "desktop.startup.refresh_usage_failed",
        fallbackToDesktopRefresh: true,
        force: true,
      });
    }, DesktopUsageAutoRefresh.STARTUP_REFRESH_DELAY_MS);
    this.intervalHandle = setInterval(() => {
      void this.refreshUsage({
        failureEvent: "desktop.auto_usage_refresh_failed",
        fallbackToDesktopRefresh: false,
        force: false,
      });
    }, DesktopUsageCache.readCacheTtlMs());
  }

  stop(): void {
    if (this.startupTimeoutHandle !== null) {
      clearTimeout(this.startupTimeoutHandle);
      this.startupTimeoutHandle = null;
    }
    if (this.intervalHandle === null) {
      return;
    }

    clearInterval(this.intervalHandle);
    this.intervalHandle = null;
  }

  private async refreshUsage(options: {
    failureEvent: string;
    fallbackToDesktopRefresh: boolean;
    force: boolean;
  }): Promise<void> {
    if (this.refresh) {
      return await this.refresh;
    }

    this.refresh = this.options.refreshAutomaticUsage({
      fallbackToDesktopRefresh: options.fallbackToDesktopRefresh,
      force: options.force,
    }).catch((error) => {
      this.options.logger.warn(options.failureEvent, {
        error: error instanceof Error ? error.message : String(error),
      });
    }).finally(() => {
      this.refresh = null;
    });

    return await this.refresh;
  }
}
