import { afterEach, describe, expect, it, vi } from "vitest";

import { DesktopUsageCache } from "../../state/UsageCache";
import { DesktopUsageAutoRefresh } from "./UsageAutoRefresh";

describe("DesktopUsageAutoRefresh", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("warms quota usage shortly after startup", async () => {
    vi.useFakeTimers();
    const refreshAutomaticUsage = vi.fn(async () => {});
    const loop = new DesktopUsageAutoRefresh({
      logger: createLogger(),
      refreshAutomaticUsage,
    });

    loop.start();
    await vi.advanceTimersByTimeAsync(1_500);

    expect(refreshAutomaticUsage).toHaveBeenCalledTimes(1);
    expect(refreshAutomaticUsage).toHaveBeenCalledWith({
      fallbackToDesktopRefresh: true,
      force: true,
    });
  });

  it("refreshes desktop usage on the cache ttl cadence", async () => {
    vi.useFakeTimers();
    const refreshAutomaticUsage = vi.fn(async () => {});
    const loop = new DesktopUsageAutoRefresh({
      logger: createLogger(),
      refreshAutomaticUsage,
    });

    loop.start();
    await vi.advanceTimersByTimeAsync(1_500);
    refreshAutomaticUsage.mockClear();
    await vi.advanceTimersByTimeAsync(DesktopUsageCache.readCacheTtlMs() - 1_500);

    expect(refreshAutomaticUsage).toHaveBeenCalledTimes(1);
    expect(refreshAutomaticUsage).toHaveBeenCalledWith({
      fallbackToDesktopRefresh: false,
      force: false,
    });
  });

  it("does not start a second refresh while the previous auto refresh is still running", async () => {
    vi.useFakeTimers();
    const deferred = createDeferred();
    const refreshAutomaticUsage = vi.fn(async () => {
      await deferred.promise;
    });
    const loop = new DesktopUsageAutoRefresh({
      logger: createLogger(),
      refreshAutomaticUsage,
    });

    loop.start();
    await vi.advanceTimersByTimeAsync(1_500);
    await vi.advanceTimersByTimeAsync(DesktopUsageCache.readCacheTtlMs() - 1_500);
    expect(refreshAutomaticUsage).toHaveBeenCalledTimes(1);

    deferred.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(DesktopUsageCache.readCacheTtlMs());
    expect(refreshAutomaticUsage).toHaveBeenCalledTimes(2);
  });

  it("stops refreshing after stop is called", async () => {
    vi.useFakeTimers();
    const refreshAutomaticUsage = vi.fn(async () => {});
    const loop = new DesktopUsageAutoRefresh({
      logger: createLogger(),
      refreshAutomaticUsage,
    });

    loop.start();
    loop.stop();
    await vi.advanceTimersByTimeAsync(DesktopUsageCache.readCacheTtlMs() * 2);

    expect(refreshAutomaticUsage).not.toHaveBeenCalled();
  });
});

function createLogger() {
  return {
    warn: vi.fn(),
  } as never;
}

function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return {
    promise,
    resolve,
  };
}
