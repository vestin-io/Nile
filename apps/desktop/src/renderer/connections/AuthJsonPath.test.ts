import { describe, expect, it } from "vitest";

import { readCodexAuthJsonPath, syncDefaultAuthJsonPath } from "./AuthJsonPath";

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

describe("syncDefaultAuthJsonPath", () => {
  it("updates the path when the current field still matches the previous default", () => {
    expect(syncDefaultAuthJsonPath(
      "~/.codex/auth.json",
      "~/.codex/auth.json",
      "/tmp/work/.codex/auth.json",
    )).toBe("/tmp/work/.codex/auth.json");
  });

  it("keeps a user-selected path when the default changes later", () => {
    expect(syncDefaultAuthJsonPath(
      "/Users/demo/Desktop/auth.json",
      "~/.codex/auth.json",
      "/tmp/work/.codex/auth.json",
    )).toBe("/Users/demo/Desktop/auth.json");
  });
});
