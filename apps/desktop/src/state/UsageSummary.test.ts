import { describe, expect, it } from "vitest";

import { resolveDesktopUsageSummary, UsageSummary } from "./UsageSummary";

describe("UsageSummary", () => {
  it("builds an available desktop usage summary from connection usage data", () => {
    expect(UsageSummary.fromResult({
      endpointFamily: "openai",
      planLabel: "Plus",
      status: "available",
      windows: [
        { label: "5h", remainingPercent: 62 },
        { label: "7d", remainingPercent: 31 },
      ],
    })).toEqual({
      status: "available",
      planLabel: "Plus",
      windows: [
        { key: "5h", label: "5h", remainingPercent: 62, resetsAt: null },
        { key: "weekly", label: "weekly", remainingPercent: 31, resetsAt: null },
      ],
      windowLabel: "weekly",
      remainingPercent: 31,
      text: "weekly 31% left",
    });
  });

  it("keeps cursor unavailable usage state instead of collapsing it to null", () => {
    expect(UsageSummary.fromResult({
      endpointFamily: "cursor",
      status: "unavailable",
      freshness: "stale",
      message: "Bind a Cursor web session for this connection to enable live quota.",
      windows: [],
    })).toEqual({
      status: "unavailable",
      freshness: "stale",
      message: "Bind a Cursor web session for this connection to enable live quota.",
      text: "Bind a Cursor web session for this connection to enable live quota.",
      windows: [],
    });
  });

  it("keeps non-cursor unavailable usage collapsed so other desktop flows stay unchanged", () => {
    expect(UsageSummary.fromResult({
      endpointFamily: "openai",
      status: "unsupported",
      message: "Quota is unavailable for openai/api_key connections.",
      windows: [],
    })).toBeNull();
  });

  it("resolves a preferred metric key when one is configured", () => {
    const usage = UsageSummary.fromResult({
      endpointFamily: "openai",
      status: "available",
      freshness: "cached",
      windows: [
        { label: "5h", remainingPercent: 62 },
        { label: "7d", remainingPercent: 31 },
      ],
    });

    expect(resolveDesktopUsageSummary(usage, "5h")).toEqual({
      key: "5h",
      label: "5h",
      remainingPercent: 62,
      text: "5h 62% left (cached)",
    });
  });
});
