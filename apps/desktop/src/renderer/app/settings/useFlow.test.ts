import { describe, expect, it } from "vitest";

import { runDesktopStateReset } from "./useFlow";

describe("runDesktopStateReset", () => {
  it("refreshes workspace profiles after resetting desktop state", async () => {
    const events: string[] = [];

    await runDesktopStateReset({
      onComplete: () => {
        events.push("complete");
      },
      refresh: async () => {
        events.push("refresh-settings");
      },
      refreshProfiles: async () => {
        events.push("refresh-profiles");
      },
      resetState: async () => {
        events.push("reset-state");
      },
    });

    expect(events).toEqual([
      "reset-state",
      "complete",
      "refresh-settings",
      "refresh-profiles",
    ]);
  });
});
