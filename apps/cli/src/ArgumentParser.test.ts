import { describe, expect, it } from "vitest";

import { defaultAgentHomes } from "@nile/core/models/agent";

import { ArgumentParser } from "./ArgumentParser";

describe("ArgumentParser", () => {
  it("accepts repeated --home assignments", () => {
    const parser = new ArgumentParser({
      databasePath: "/tmp/nile.sqlite",
    });

    const parsed = parser.parse([
      "status",
      "--home",
      "codex=/tmp/codex-home",
      "--home",
      "cursor=/tmp/cursor-home",
    ]);

    expect(parsed.command).toEqual(["status"]);
    expect(parsed.options.agentHomes).toEqual({
      ...defaultAgentHomes(),
      codex: "/tmp/codex-home",
      cursor: "/tmp/cursor-home",
    });
  });

  it("accepts a single agent-specific --home assignment", () => {
    const parser = new ArgumentParser({
      databasePath: "/tmp/nile.sqlite",
    });

    const parsed = parser.parse(["status", "--home", "claude=/tmp/claude-home"]);

    expect(parsed.options.agentHomes).toEqual({
      ...defaultAgentHomes(),
      claude: "/tmp/claude-home",
    });
  });

  it("rejects unsupported --home targets", () => {
    const parser = new ArgumentParser({
      databasePath: "/tmp/nile.sqlite",
    });

    expect(() => parser.parse(["status", "--home", "zed=/tmp/zed-home"])).toThrow(
      "Unsupported agent for --home: zed",
    );
  });

  it("documents the reset command in help output", () => {
    const parser = new ArgumentParser({
      databasePath: "/tmp/nile.sqlite",
    });

    expect(parser.helpText()).toContain("nile reset [--json] [--db-path <path>]");
    expect(parser.helpText()).toContain("nile reset --yes --confirm-reset [--json] [--db-path <path>]");
  });

  it("rejects unknown flags instead of silently accepting typos", () => {
    const parser = new ArgumentParser({
      databasePath: "/tmp/nile.sqlite",
    });

    expect(() => parser.parse(["status", "--jsno"])).toThrow("Unknown flag: --jsno");
  });
});
