import { describe, expect, it, vi } from "vitest";

import { DesktopStateRefresher } from "./DesktopStateRefresher";

describe("DesktopStateRefresher", () => {
  it("refreshes desktop state before notifying the renderer", async () => {
    const calls: string[] = [];
    const evaluate = vi.fn();
    const refresher = new DesktopStateRefresher({
      alertEvaluator: { evaluate } as never,
      logger: createLoggerStub(),
      notifyRenderer: () => {
        calls.push("notify");
      },
      stateStore: {
        invalidateAll: () => {
          calls.push("invalidate");
        },
        refreshCachedCurrentUsage: async () => ({
          changed: false,
          hasCachedState: true,
          refreshed: false,
          settingsState: null,
        }),
        refreshDesktopState: async () => {
          calls.push("refresh");
          return {} as never;
        },
        getSettingsState: async () => ({}) as never,
      } as never,
    });

    await refresher.refreshDesktopState({
      invalidate: true,
      notifyRenderer: true,
    });

    expect(calls).toEqual(["invalidate", "refresh", "notify"]);
    expect(evaluate).toHaveBeenCalled();
  });

  it("does not notify the renderer when refreshDesktopState fails", async () => {
    const notifyRenderer = vi.fn();
    const refresher = new DesktopStateRefresher({
      logger: createLoggerStub(),
      notifyRenderer,
      stateStore: {
        invalidateAll: vi.fn(),
        refreshCachedCurrentUsage: async () => ({
          changed: false,
          hasCachedState: true,
          refreshed: false,
          settingsState: null,
        }),
        refreshDesktopState: async () => {
          throw new Error("status entry failed");
        },
        getSettingsState: async () => ({}) as never,
      } as never,
    });

    await expect(refresher.refreshDesktopState({
      invalidate: false,
      notifyRenderer: true,
    })).rejects.toThrow("status entry failed");
    expect(notifyRenderer).not.toHaveBeenCalled();
  });

  it("passes manual usage refresh mode through desktop refreshes", async () => {
    const refreshDesktopState = vi.fn(async () => ({}));
    const refresher = new DesktopStateRefresher({
      logger: createLoggerStub(),
      notifyRenderer: vi.fn(),
      stateStore: {
        invalidateAll: vi.fn(),
        refreshCachedCurrentUsage: async () => ({
          changed: false,
          hasCachedState: true,
          refreshed: false,
          settingsState: null,
        }),
        refreshDesktopState,
        getSettingsState: async () => ({}) as never,
      } as never,
    });

    await refresher.refreshDesktopState({
      invalidate: false,
      notifyRenderer: false,
      usageRefreshMode: "manual",
    });

    expect(refreshDesktopState).toHaveBeenCalledWith({
      refreshSettingsUsage: undefined,
      usageRefreshMode: "manual",
    });
  });

  it("passes forced settings usage refresh through desktop refreshes", async () => {
    const refreshDesktopState = vi.fn(async () => ({}));
    const refresher = new DesktopStateRefresher({
      logger: createLoggerStub(),
      notifyRenderer: vi.fn(),
      stateStore: {
        invalidateAll: vi.fn(),
        refreshCachedCurrentUsage: async () => ({
          changed: false,
          hasCachedState: true,
          refreshed: false,
          settingsState: null,
        }),
        refreshDesktopState,
        getSettingsState: async () => ({}) as never,
      } as never,
    });

    await refresher.refreshDesktopState({
      forceSettingsUsageRefresh: true,
      invalidate: false,
      notifyRenderer: false,
      refreshSettingsUsage: true,
      usageRefreshMode: "manual",
    });

    expect(refreshDesktopState).toHaveBeenCalledWith({
      forceSettingsUsageRefresh: true,
      refreshSettingsUsage: true,
      usageRefreshMode: "manual",
    });
  });

  it("passes interactive recovery overrides through desktop refreshes", async () => {
    const refreshDesktopState = vi.fn(async () => ({}));
    const refresher = new DesktopStateRefresher({
      logger: createLoggerStub(),
      notifyRenderer: vi.fn(),
      stateStore: {
        invalidateAll: vi.fn(),
        refreshCachedCurrentUsage: async () => ({
          changed: false,
          hasCachedState: true,
          refreshed: false,
          settingsState: null,
        }),
        refreshDesktopState,
        getSettingsState: async () => ({}) as never,
      } as never,
    });

    await refresher.refreshDesktopState({
      allowInteractiveUnauthorizedCurrentSessionRecovery: false,
      invalidate: false,
      notifyRenderer: false,
      refreshSettingsUsage: true,
      usageRefreshMode: "manual",
    });

    expect(refreshDesktopState).toHaveBeenCalledWith({
      allowInteractiveUnauthorizedCurrentSessionRecovery: false,
      refreshSettingsUsage: true,
      usageRefreshMode: "manual",
    });
  });

  it("keeps automatic usage refreshes silent when nothing changed", async () => {
    const notifyRenderer = vi.fn();
    const refresher = new DesktopStateRefresher({
      alertEvaluator: { evaluate: vi.fn() } as never,
      logger: createLoggerStub(),
      notifyRenderer,
      stateStore: {
        invalidateAll: vi.fn(),
        refreshCachedCurrentUsage: async () => ({
          changed: false,
          hasCachedState: true,
          refreshed: false,
          settingsState: null,
        }),
        refreshDesktopState: async () => ({}) as never,
        getSettingsState: async () => ({}) as never,
      } as never,
    });

    await refresher.refreshAutomaticUsage();

    expect(notifyRenderer).not.toHaveBeenCalled();
  });

  it("evaluates alerts and notifies after a changed automatic usage refresh", async () => {
    const evaluate = vi.fn();
    const notifyRenderer = vi.fn();
    const refresher = new DesktopStateRefresher({
      alertEvaluator: { evaluate } as never,
      logger: createLoggerStub(),
      notifyRenderer,
      stateStore: {
        invalidateAll: vi.fn(),
        refreshCachedCurrentUsage: async () => ({
          changed: true,
          hasCachedState: true,
          refreshed: true,
          settingsState: { connections: [] } as never,
        }),
        refreshDesktopState: async () => ({}) as never,
        getSettingsState: async () => ({}) as never,
      } as never,
    });

    await refresher.refreshAutomaticUsage();

    expect(evaluate).toHaveBeenCalledWith({ connections: [] });
    expect(notifyRenderer).toHaveBeenCalledTimes(1);
  });

  it("falls back to a full desktop refresh when startup auto usage has no cached state", async () => {
    const refreshDesktopState = vi.fn(async () => ({}));
    const refresher = new DesktopStateRefresher({
      logger: createLoggerStub(),
      notifyRenderer: vi.fn(),
      stateStore: {
        invalidateAll: vi.fn(),
        refreshCachedCurrentUsage: async () => ({
          changed: false,
          hasCachedState: false,
          refreshed: false,
          settingsState: null,
        }),
        refreshDesktopState,
        getSettingsState: async () => ({}) as never,
      } as never,
    });

    await refresher.refreshAutomaticUsage({ fallbackToDesktopRefresh: true, force: true });

    expect(refreshDesktopState).toHaveBeenCalledWith({
      forceStatusEntryUsageRefresh: true,
      refreshSettingsUsage: false,
      refreshStatusEntryUsage: true,
      usageRefreshMode: "auto",
    });
  });
});

function createLoggerStub() {
  return {
    warn: vi.fn(),
  } as never;
}
