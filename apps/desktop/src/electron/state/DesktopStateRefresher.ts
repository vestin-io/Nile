import type { NileLogger } from "@nile/core/services/NileLogger";

import type { DesktopUsageRefreshMode } from "../../state/UsageCache";
import { ConnectionUsageAlertEvaluator } from "../alerts/Evaluator";
import { DesktopStateStore } from "./DesktopStateStore";

type RefreshDesktopStateOptions = {
  forceStatusEntryUsageRefresh?: boolean;
  invalidate: boolean;
  notifyRenderer: boolean;
  refreshSettingsUsage?: boolean;
  refreshStatusEntryUsage?: boolean;
  usageRefreshMode?: DesktopUsageRefreshMode;
};

type RefreshAutomaticUsageOptions = {
  fallbackToDesktopRefresh?: boolean;
  force?: boolean;
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

    const settingsState = await this.options.stateStore.refreshDesktopState({
      ...(typeof options.forceStatusEntryUsageRefresh === "boolean"
        ? { forceStatusEntryUsageRefresh: options.forceStatusEntryUsageRefresh }
        : {}),
      refreshSettingsUsage: options.refreshSettingsUsage,
      refreshStatusEntryUsage: options.refreshStatusEntryUsage,
      usageRefreshMode: options.usageRefreshMode,
    });
    this.evaluateAlerts(settingsState);

    if (options.notifyRenderer) {
      this.options.notifyRenderer();
    }
  }

  async refreshAutomaticUsage(options: RefreshAutomaticUsageOptions = {}): Promise<void> {
    const result = await this.options.stateStore.refreshCachedCurrentUsage({
      force: options.force,
      mode: "auto",
    });
    if (!result.hasCachedState && options.fallbackToDesktopRefresh === true) {
      await this.refreshDesktopState({
        forceStatusEntryUsageRefresh: true,
        invalidate: false,
        notifyRenderer: true,
        refreshSettingsUsage: false,
        refreshStatusEntryUsage: true,
        usageRefreshMode: "auto",
      });
      return;
    }

    if (!result.changed) {
      return;
    }

    if (result.settingsState) {
      this.evaluateAlerts(result.settingsState);
    }
    this.options.notifyRenderer();
  }

  private evaluateAlerts(settingsState: Awaited<ReturnType<DesktopStateStore["getSettingsState"]>>): void {
    if (!this.options.alertEvaluator) {
      return;
    }
    this.options.alertEvaluator.evaluate(settingsState);
  }
}
