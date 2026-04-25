import { describe, expect, it } from "vitest";

import { CursorUsageSessionSourceProbe } from "./Probe";
import type { CursorUsageSessionCandidate, CursorUsageSessionProbe } from "./Types";

describe("CursorUsageSessionSourceProbe", () => {
  it("stops after the first probe that returns candidates", () => {
    const stateProbe = new StaticProbe([
      {
        sourceId: "cursor-local-state",
        sourceLabel: "Cursor",
        locationLabel: "Local session",
        workosUserId: "user_123",
        sessionToken: "user_123::token",
      },
    ]);
    const fallbackProbe = new RecordingProbe();
    const probe = new CursorUsageSessionSourceProbe([stateProbe, fallbackProbe]);

    expect(probe.probe()).toEqual([
      {
        sourceId: "cursor-local-state",
        sourceLabel: "Cursor",
        locationLabel: "Local session",
        workosUserId: "user_123",
        sessionToken: "user_123::token",
      },
    ]);
    expect(fallbackProbe.called).toBe(false);
  });
});

class StaticProbe implements CursorUsageSessionProbe {
  constructor(private readonly candidates: CursorUsageSessionCandidate[]) {}

  probe(): CursorUsageSessionCandidate[] {
    return this.candidates;
  }
}

class RecordingProbe implements CursorUsageSessionProbe {
  called = false;

  probe(): CursorUsageSessionCandidate[] {
    this.called = true;
    return [];
  }
}
