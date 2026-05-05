import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AgentHomesStore } from "./AgentHomesStore";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("AgentHomesStore", () => {
  it("stores a custom override", () => {
    const path = createStorePath();
    const store = new AgentHomesStore(path);

    const result = store.update("openclaw", "/tmp/openclaw-home");

    expect(result).toEqual({ openclaw: "/tmp/openclaw-home" });
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
      openclaw: "/tmp/openclaw-home",
    });
  });

  it("expands a tilde-prefixed path", () => {
    const store = new AgentHomesStore(createStorePath());

    const result = store.update("claude", "~/.claude-alt");

    expect(result.claude).toBe(join(process.env.HOME ?? "", ".claude-alt"));
  });

  it("drops overrides when resetting to the default path", () => {
    const store = new AgentHomesStore(createStorePath());
    store.update("codex", "/tmp/custom-codex");

    const result = store.update("codex", "~/.codex");

    expect(result).toEqual({});
  });
});

function createStorePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-agent-homes-"));
  tempDirs.push(dir);
  return join(dir, "agent-homes.json");
}
