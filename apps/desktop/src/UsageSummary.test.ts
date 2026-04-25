import { describe, expect, it } from "vitest";

import { UsageSummary } from "./UsageSummary";

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
        { label: "5h", remainingPercent: 62, resetsAt: null },
        { label: "weekly", remainingPercent: 31, resetsAt: null },
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
      message: "Bind a Cursor web session for this connection to enable live usage.",
      windows: [],
    })).toEqual({
      status: "unavailable",
      freshness: "stale",
      message: "Bind a Cursor web session for this connection to enable live usage.",
      text: "Bind a Cursor web session for this connection to enable live usage.",
      windows: [],
    });
  });

  it("keeps non-cursor unavailable usage collapsed so other desktop flows stay unchanged", () => {
    expect(UsageSummary.fromResult({
      endpointFamily: "openai",
      status: "unsupported",
      message: "Usage is unavailable for openai/api_key connections.",
      windows: [],
    })).toBeNull();
  });
});
