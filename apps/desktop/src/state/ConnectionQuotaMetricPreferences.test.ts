import { describe, expect, it } from "vitest";

import {
  normalizeConnectionQuotaMetricPreferences,
  parseConnectionQuotaMetricPreferencesFromDesktopPreferences,
  readConnectionQuotaMetricPreference,
  writeConnectionQuotaMetricPreference,
} from "./ConnectionQuotaMetricPreferences";

describe("ConnectionQuotaMetricPreferences", () => {
  it("normalizes only non-empty string metric preferences", () => {
    expect(normalizeConnectionQuotaMetricPreferences({
      " connection-a ": " weekly ",
      "": "5h",
      "connection-b": "",
      "connection-c": 42,
    })).toEqual({
      "connection-a": "weekly",
    });
  });

  it("parses connection quota metric preferences from desktop preferences storage", () => {
    expect(parseConnectionQuotaMetricPreferencesFromDesktopPreferences(JSON.stringify({
      connectionQuotaMetricPreferences: {
        "connection-a": "weekly",
      },
    }))).toEqual({
      "connection-a": "weekly",
    });
  });

  it("writes and clears a single connection preference", () => {
    const written = writeConnectionQuotaMetricPreference({}, "connection-a", "weekly");
    expect(readConnectionQuotaMetricPreference(written, "connection-a")).toBe("weekly");
    expect(writeConnectionQuotaMetricPreference(written, "connection-a", null)).toEqual({});
  });
});
