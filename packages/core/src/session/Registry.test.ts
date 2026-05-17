import { describe, expect, it } from "vitest";

import { CURRENT_SESSION_SOURCE_REGISTRY } from "./Registry";

describe("CurrentSessionSourceRegistry", () => {
  it("registers the supported current-session sources", () => {
    expect(CURRENT_SESSION_SOURCE_REGISTRY.list().map((manifest) => manifest.id)).toEqual([
      "current_codex",
      "current_cursor",
      "current_claude",
      "current_gemini",
    ]);
  });

  it("describes Gemini as a gemini_cli_session source owned by the Gemini family", () => {
    expect(CURRENT_SESSION_SOURCE_REGISTRY.read("current_gemini")).toMatchObject({
      id: "current_gemini",
      familyId: "gemini-cli-session",
      authMode: "gemini_cli_session",
      label: "Current Gemini session",
    });
  });

  it("rejects mismatched auth mode requests", () => {
    expect(() =>
      CURRENT_SESSION_SOURCE_REGISTRY.resolve(
        {
          agentHomes: undefined,
          environment: {} as never,
        },
        {
          authMode: "cursor_session",
          source: "current_gemini",
        } as never,
      ),
    ).toThrow("Current session source current_gemini does not support auth mode cursor_session");
  });
});
