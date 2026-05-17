import { describe, expect, it } from "vitest";

import { SHARED_SESSION_CONNECTION_METHODS } from "./MethodCatalog";

describe("SessionConnectionMethodCatalog", () => {
  it("reads browser-based interactive login behavior for Codex-backed OpenAI sign-in", () => {
    expect(SHARED_SESSION_CONNECTION_METHODS.readMethod("openai_session", "login")).toMatchObject({
      authMode: "openai_session",
      source: "login",
      interactionMode: "browser_oauth",
    });
  });

  it("reads terminal-interactive behavior for Gemini sign-in", () => {
    expect(SHARED_SESSION_CONNECTION_METHODS.readMethod("gemini_cli_session", "login")).toMatchObject({
      authMode: "gemini_cli_session",
      source: "login",
      interactionMode: "terminal_interactive",
    });
  });
});
