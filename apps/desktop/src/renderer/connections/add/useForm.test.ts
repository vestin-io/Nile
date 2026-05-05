import { describe, expect, it } from "vitest";

import { sameAgentSelection } from "./useForm";

describe("sameAgentSelection", () => {
  it("treats identical agent selections as equal", () => {
    expect(sameAgentSelection(["codex", "claude"], ["codex", "claude"])).toBe(true);
  });

  it("treats a reordered agent selection as different", () => {
    expect(sameAgentSelection(["codex", "claude"], ["claude", "codex"])).toBe(false);
  });

  it("treats length changes as different", () => {
    expect(sameAgentSelection(["codex"], ["codex", "claude"])).toBe(false);
  });
});
