import { describe, expect, it } from "vitest";

import { buildConnectionMethods } from "../ConnectionFormParts";
import { resolveSessionSourceSelection, sameAgentSelection } from "./useForm";
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
      iconKey: "openai",
      supportedAuthModes: ["openai_session"],
      requiresEndpointUrl: false,
      configurableAgents: ["codex", "openclaw"],
      selectableAgents: ["codex", "openclaw"],
      defaultEnabledAgents: ["codex"],
      supportsEnvKey: false,
      suggestEnabledAgents: false,
    }, (key) => key);

    expect(methods.map((method) => method.key)).toEqual([
      "openai_session:current_codex",
      "openai_session:login",
    ]);
  });

  it("offers Gemini as a sign-in-only add flow", () => {
    const methods = buildConnectionMethods({
      preset: "gemini",
      label: "Gemini CLI",
      iconKey: "gemini",
      supportedAuthModes: ["gemini_cli_session"],
      requiresEndpointUrl: false,
      configurableAgents: ["gemini"],
      selectableAgents: ["gemini"],
      defaultEnabledAgents: ["gemini"],
      supportsEnvKey: false,
      suggestEnabledAgents: false,
    }, (key) => key);

    expect(methods.map((method) => method.key)).toEqual(["gemini_cli_session:login"]);
  });
});

describe("resolveSessionSourceSelection", () => {
  it("prefers the current Codex import when OpenAI session auth becomes active", () => {
    expect(resolveSessionSourceSelection("openai_session", "login", { preferDefault: true })).toBe("current_codex");
  });

  it("switches unsupported carry-over session sources to the auth mode default", () => {
    expect(resolveSessionSourceSelection("gemini_cli_session", "current_codex", { preferDefault: true })).toBe("login");
  });
});
