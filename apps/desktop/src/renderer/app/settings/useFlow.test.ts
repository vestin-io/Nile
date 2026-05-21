import { describe, expect, it } from "vitest";

import type { DesktopPreferences } from "../../settings/Preferences";
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
      setPreferences(updater) {
        const current: DesktopPreferences = {
          agentOrder: [],
          connectionQuotaMetricPreferences: {},
          language: "en",
          quickSetupDismissed: true,
          theme: "system",
        };
        const next = typeof updater === "function"
          ? updater(current)
          : updater;
        events.push(`quick-setup-dismissed:${String(next.quickSetupDismissed)}`);
        return next;
      },
    });

    expect(events).toEqual([
      "reset-state",
      "quick-setup-dismissed:false",
      "complete",
      "refresh-settings",
      "refresh-profiles",
    ]);
  });
});
