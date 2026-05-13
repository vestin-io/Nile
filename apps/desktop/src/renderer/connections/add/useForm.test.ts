import { describe, expect, it } from "vitest";

import { buildConnectionMethods } from "../ConnectionFormParts";
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

describe("buildConnectionMethods", () => {
  it("prefers importing the current Codex session before triggering sign-in", () => {
    const methods = buildConnectionMethods({
      preset: "openai",
      label: "Official OpenAI",
      supportedAuthModes: ["openai_session"],
      requiresEndpointUrl: false,
      configurableAgents: ["codex", "openclaw"],
      defaultEnabledAgents: ["codex"],
      supportsEnvKey: false,
      suggestEnabledAgents: false,
    }, (key) => key);

    expect(methods.map((method) => method.key)).toEqual([
      "openai_session:current_codex",
      "openai_session:login",
    ]);
  });
});
