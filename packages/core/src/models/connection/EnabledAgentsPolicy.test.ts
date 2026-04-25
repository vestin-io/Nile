import { describe, expect, it } from "vitest";

import { EnabledAgentsPolicy } from "./EnabledAgentsPolicy";

describe("EnabledAgentsPolicy", () => {
  it("retains only configurable agents from the current selection", () => {
    const policy = new EnabledAgentsPolicy();

    expect(policy.reconcile(
      ["codex", "cursor"],
      ["codex", "claude"],
      ["claude"],
    )).toEqual(["codex"]);
  });

  it("falls back to the suggested defaults when nothing retained is configurable", () => {
    const policy = new EnabledAgentsPolicy();

    expect(policy.reconcile(
      ["cursor"],
      ["codex", "claude"],
      ["claude", "openclaw", "cursor"],
    )).toEqual(["claude"]);
  });
});
