import { describe, expect, it } from "vitest";

import { readPendingSaveMessageKey, shouldKeepPendingSave } from "./SaveState";

describe("shouldKeepPendingSave", () => {
  it("keeps the spinner visible while the save is still waiting for external confirmation", () => {
    expect(
      shouldKeepPendingSave({
        confirmed: false,
        hasLocalSetup: true,
        phase: "saving",
      }),
    ).toBe(true);
  });

  it("stops the spinner once the saved state is externally confirmed", () => {
    expect(
      shouldKeepPendingSave({
        confirmed: true,
        hasLocalSetup: true,
        phase: "saving",
      }),
    ).toBe(false);
  });

  it("stops the spinner when the local setup no longer needs a save action", () => {
    expect(
      shouldKeepPendingSave({
        confirmed: false,
        hasLocalSetup: false,
        phase: "saving",
      }),
    ).toBe(false);
  });

  it("maps pending phases to user-facing helper messages", () => {
    expect(readPendingSaveMessageKey("saving")).toBe("quickSetup.saveProgress.saving");
    expect(readPendingSaveMessageKey("idle")).toBeNull();
  });
});
