import { describe, expect, it } from "vitest";

import { readCodexAuthJsonPath } from "./AuthJsonPath";

describe("readCodexAuthJsonPath", () => {
  it("uses the configured Codex home when available", () => {
    expect(readCodexAuthJsonPath([
      {
        agentId: "codex",
        agentLabel: "Codex",
        path: "/Users/tester/Library/Application Support/Codex",
        defaultPath: "~/.codex",
      },
    ])).toBe("/Users/tester/Library/Application Support/Codex/auth.json");
  });

  it("falls back to the standard Codex auth.json path", () => {
    expect(readCodexAuthJsonPath([])).toBe("~/.codex/auth.json");
  });
});
