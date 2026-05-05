import type { NileLogger } from "@nile/core/services/NileLogger";

import { DesktopStateStore } from "./DesktopStateStore";

type RefreshDesktopStateOptions = {
  invalidate: boolean;
  notifyRenderer: boolean;
};

type RefreshMenubarUsageOptions = {
  notifyRenderer?: boolean;
  tolerateFailures?: boolean;
};

type DesktopStateRefresherOptions = {
  logger: NileLogger;
  notifyRenderer(): void;
  stateStore: DesktopStateStore;
};

export class DesktopStateRefresher {
  constructor(private readonly options: DesktopStateRefresherOptions) {}

  async refreshDesktopState(options: RefreshDesktopStateOptions): Promise<void> {
    if (options.invalidate) {
      this.options.stateStore.invalidateAll();
    }

    await Promise.all([
      this.options.stateStore.refreshMenubarState(),
      this.refreshMenubarUsage({
        notifyRenderer: false,
        tolerateFailures: false,
      }),
    ]);

    if (options.notifyRenderer) {
      this.options.notifyRenderer();
    }
  }

  async refreshMenubarUsage(options: RefreshMenubarUsageOptions = {}): Promise<void> {
    const notifyRenderer = options.notifyRenderer ?? true;
    const tolerateFailures = options.tolerateFailures ?? true;

    try {
      await this.options.stateStore.refreshMenubarUsage();
      if (notifyRenderer) {
        this.options.notifyRenderer();
      }
    } catch (error) {
      if (!tolerateFailures) {
        throw error;
      }

      this.options.logger.warn("desktop.menubar_usage_refresh_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
