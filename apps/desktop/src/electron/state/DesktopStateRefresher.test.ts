import { describe, expect, it, vi } from "vitest";

import { DesktopStateRefresher } from "./DesktopStateRefresher";

describe("DesktopStateRefresher", () => {
  it("refreshes both menubar state and usage before notifying the renderer", async () => {
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
        refreshMenubarState: async () => {
          calls.push("state");
          return {} as never;
        },
        refreshMenubarUsage: async () => {
          calls.push("usage");
        },
        getSettingsState: async () => ({}) as never,
      } as never,
    });

    await refresher.refreshDesktopState({
      invalidate: true,
      notifyRenderer: true,
    });

    expect(calls).toEqual(["invalidate", "state", "usage", "notify"]);
    expect(evaluate).toHaveBeenCalled();
  });

  it("does not notify the renderer when refreshDesktopState fails", async () => {
    const notifyRenderer = vi.fn();
    const refresher = new DesktopStateRefresher({
      logger: createLoggerStub(),
      notifyRenderer,
      stateStore: {
        invalidateAll: vi.fn(),
        refreshMenubarState: async () => {
          throw new Error("menubar failed");
        },
        refreshMenubarUsage: async () => {},
        getSettingsState: async () => ({}) as never,
      } as never,
    });

    await expect(refresher.refreshDesktopState({
      invalidate: false,
      notifyRenderer: true,
    })).rejects.toThrow("menubar failed");
    expect(notifyRenderer).not.toHaveBeenCalled();
  });

  it("rethrows usage refresh failures when strict refresh is requested", async () => {
    const notifyRenderer = vi.fn();
    const refresher = new DesktopStateRefresher({
      logger: createLoggerStub(),
      notifyRenderer,
      stateStore: {
        invalidateAll: vi.fn(),
        refreshMenubarState: async () => ({}) as never,
        refreshMenubarUsage: async () => {
          throw new Error("usage failed");
        },
        getSettingsState: async () => ({}) as never,
      } as never,
    });

    await expect(refresher.refreshDesktopState({
      invalidate: false,
      notifyRenderer: true,
    })).rejects.toThrow("usage failed");
    expect(notifyRenderer).not.toHaveBeenCalled();
  });

  it("keeps tolerant menubar usage refreshes non-fatal", async () => {
    const notifyRenderer = vi.fn();
    const refresher = new DesktopStateRefresher({
      logger: createLoggerStub(),
      notifyRenderer,
      stateStore: {
        invalidateAll: vi.fn(),
        refreshMenubarState: async () => ({}) as never,
        refreshMenubarUsage: async () => {
          throw new Error("usage failed");
        },
        getSettingsState: async () => ({}) as never,
      } as never,
    });

    await expect(refresher.refreshMenubarUsage()).resolves.toBeUndefined();
    expect(notifyRenderer).not.toHaveBeenCalled();
  });

  it("evaluates alerts after a successful standalone usage refresh", async () => {
    const evaluate = vi.fn();
    const refresher = new DesktopStateRefresher({
      alertEvaluator: { evaluate } as never,
      logger: createLoggerStub(),
      notifyRenderer: vi.fn(),
      stateStore: {
        invalidateAll: vi.fn(),
        refreshMenubarState: async () => ({}) as never,
        refreshMenubarUsage: async () => {},
        getSettingsState: async () => ({ connections: [] }) as never,
      } as never,
    });

    await refresher.refreshMenubarUsage();

    expect(evaluate).toHaveBeenCalled();
  });
});

function createLoggerStub() {
  return {
    warn: vi.fn(),
  } as never;
}
