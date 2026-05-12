import { describe, expect, it } from "vitest";

import { DesktopConnectionModelCatalog } from "./ModelCatalog";

describe("DesktopConnectionModelCatalog", () => {
  it("reuses cached results within the ttl window", async () => {
    let now = 1_000;
    let readCount = 0;
    const catalog = new DesktopConnectionModelCatalog({
      ttlMs: 10_000,
      now: () => now,
    });

    const first = await catalog.read("work", async () => {
      readCount += 1;
      return {
        connectionId: "work",
        status: "available",
        models: ["gpt-5.4"],
      };
    });
    const second = await catalog.read("work", async () => {
      readCount += 1;
      return {
        connectionId: "work",
        status: "available",
        models: ["gpt-5.5"],
      };
    });

    expect(first.models).toEqual(["gpt-5.4"]);
    expect(second.models).toEqual(["gpt-5.4"]);
    expect(readCount).toBe(1);

    now += 10_001;
    const third = await catalog.read("work", async () => {
      readCount += 1;
      return {
        connectionId: "work",
        status: "available",
        models: ["gpt-5.5"],
      };
    });

    expect(third.models).toEqual(["gpt-5.5"]);
    expect(readCount).toBe(2);
  });

  it("bypasses the cache when refresh is forced", async () => {
    let readCount = 0;
    const catalog = new DesktopConnectionModelCatalog();

    await catalog.read("work", async () => {
      readCount += 1;
      return {
        connectionId: "work",
        status: "available",
        models: ["gpt-5.4"],
      };
    });
    const refreshed = await catalog.read("work", async () => {
      readCount += 1;
      return {
        connectionId: "work",
        status: "available",
        models: ["gpt-5.5"],
      };
    }, { forceRefresh: true });

    expect(refreshed.models).toEqual(["gpt-5.5"]);
    expect(readCount).toBe(2);
  });
});
