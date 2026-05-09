import { describe, expect, it } from "vitest";

import { sameAgentSelection } from "./useForm";
import { resolveDetectedEnabledAgents } from "./useOnboardingState";

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

describe("resolveDetectedEnabledAgents", () => {
  it("uses detected defaults when the user has not edited the agent selection", () => {
    expect(resolveDetectedEnabledAgents({
      current: ["codex"],
      configurableAgents: ["codex", "claude", "cursor"],
      defaultEnabledAgents: ["codex", "claude"],
      preserveCurrent: false,
    })).toEqual(["codex", "claude"]);
  });

  it("preserves a manual agent selection after support detection", () => {
    expect(resolveDetectedEnabledAgents({
      current: ["codex"],
      configurableAgents: ["codex", "claude", "cursor"],
      defaultEnabledAgents: ["codex", "claude"],
      preserveCurrent: true,
    })).toEqual(["codex"]);
  });
});
