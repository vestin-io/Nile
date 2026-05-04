import { describe, expect, it } from "vitest";

import { shouldKeepPendingSave } from "./SaveState";

describe("shouldKeepPendingSave", () => {
  it("keeps the spinner visible while the save is still waiting for external confirmation", () => {
    expect(
      shouldKeepPendingSave({
        confirmed: false,
        hasLocalSetup: true,
        phase: "pending-confirmation",
      }),
    ).toBe(true);
  });

  it("stops the spinner once the saved state is externally confirmed", () => {
    expect(
      shouldKeepPendingSave({
        confirmed: true,
        hasLocalSetup: true,
        phase: "pending-confirmation",
      }),
    ).toBe(false);
  });

  it("stops the spinner when the local setup no longer needs a save action", () => {
    expect(
      shouldKeepPendingSave({
        confirmed: false,
        hasLocalSetup: false,
        phase: "pending-confirmation",
      }),
    ).toBe(false);
  });
});
