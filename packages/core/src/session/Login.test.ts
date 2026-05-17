import { describe, expect, it } from "vitest";

import { INTERACTIVE_SESSION_LOGIN_REGISTRY } from "./Login";

describe("InteractiveSessionLoginRegistry", () => {
  it("registers the supported interactive login sources", () => {
    expect(INTERACTIVE_SESSION_LOGIN_REGISTRY.list().map((manifest) => manifest.authMode)).toEqual([
      "openai_session",
      "claude_session",
      "gemini_cli_session",
    ]);
  });

  it("describes OpenAI login as a Codex-backed sign-in source", () => {
    expect(INTERACTIVE_SESSION_LOGIN_REGISTRY.read("openai_session")).toMatchObject({
      authMode: "openai_session",
      label: "Sign in with Codex",
    });
  });

  it("reads interactive login ownership from agent modules", () => {
    expect(INTERACTIVE_SESSION_LOGIN_REGISTRY.read("claude_session")).toMatchObject({
      authMode: "claude_session",
      label: "Sign in with Claude",
    });
  });

  it("reads Gemini login ownership from agent modules", () => {
    expect(INTERACTIVE_SESSION_LOGIN_REGISTRY.read("gemini_cli_session")).toMatchObject({
      authMode: "gemini_cli_session",
      label: "Sign in with Gemini",
    });
  });
});
