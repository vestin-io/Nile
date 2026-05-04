import { describe, expect, it } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";

import { readDefaultAgentHome, resolveAgentHome } from "./Homes";

describe("readDefaultAgentHome", () => {
  it("prefers the Codex home that actually contains auth or config state", () => {
    const codexAppSupportPath = join(homedir(), "Library", "Application Support", "Codex");
    const codexDotPath = join(homedir(), ".codex");
    const existingPaths = new Set([
      join(codexDotPath, "auth.json"),
      codexAppSupportPath,
    ]);

    expect(readDefaultAgentHome("codex", (path) => existingPaths.has(path))).toBe(codexDotPath);
  });

  it("uses the Claude app support home only when it contains Claude state files", () => {
    const claudeAppSupportPath = join(homedir(), "Library", "Application Support", "Claude");
    const existingPaths = new Set([
      join(claudeAppSupportPath, "settings.json"),
    ]);

    expect(readDefaultAgentHome("claude", (path) => existingPaths.has(path))).toBe(claudeAppSupportPath);
  });

  it("falls back to the first legacy home when no state markers exist", () => {
    expect(readDefaultAgentHome("claude", () => false)).toBe(join(homedir(), ".claude"));
  });
});

describe("resolveAgentHome", () => {
  it("keeps an explicit override instead of probing defaults", () => {
    expect(resolveAgentHome("codex", { codex: "/tmp/custom-codex-home" })).toBe("/tmp/custom-codex-home");
  });
});
