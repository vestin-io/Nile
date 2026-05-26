import type { NileLogger } from "@nile/core/services/NileLogger";

import type { DesktopUsageRefreshMode } from "../../state/UsageCache";
import { ConnectionUsageAlertEvaluator } from "../alerts/Evaluator";
import { DesktopStateStore } from "./DesktopStateStore";

type RefreshDesktopStateOptions = {
  invalidate: boolean;
  notifyRenderer: boolean;
  usageRefreshMode?: DesktopUsageRefreshMode;
};

type RefreshStatusEntryUsageOptions = {
  mode?: DesktopUsageRefreshMode;
  notifyRenderer?: boolean;
  tolerateFailures?: boolean;
};

type DesktopStateRefresherOptions = {
  alertEvaluator?: ConnectionUsageAlertEvaluator;
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
      this.options.stateStore.refreshStatusEntryState(),
      this.options.stateStore.refreshStatusEntryUsage({ mode: options.usageRefreshMode }),
    ]);
    await this.evaluateAlerts();

    if (options.notifyRenderer) {
      this.options.notifyRenderer();
    }
  }

  async refreshStatusEntryUsage(options: RefreshStatusEntryUsageOptions = {}): Promise<void> {
    const notifyRenderer = options.notifyRenderer ?? true;
    const tolerateFailures = options.tolerateFailures ?? true;

    try {
      await this.options.stateStore.refreshStatusEntryUsage({ mode: options.mode });
      await this.evaluateAlerts();
      if (notifyRenderer) {
        this.options.notifyRenderer();
      }
    } catch (error) {
      if (!tolerateFailures) {
        throw error;
      }

      this.options.logger.warn("desktop.status_entry_usage_refresh_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async evaluateAlerts(): Promise<void> {
    if (!this.options.alertEvaluator) {
      return;
    }
    const settingsState = await this.options.stateStore.getSettingsState({ refreshUsage: false });
    this.options.alertEvaluator.evaluate(settingsState);
  }
}
