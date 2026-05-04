import { describe, expect, it } from "vitest";

import { SecurityCli } from "./SecurityCli";

describe("SecurityCli", () => {
  it("runs security with the provided arguments", () => {
    const calls: Array<{ command: string; args: readonly string[]; options: { encoding: "utf8"; input?: string } }> = [];
    const cli = new SecurityCli(
      (command, args, options) => {
        calls.push({ command, args, options });
        return {
          status: 0,
          stdout: "stdout-value",
          stderr: "stderr-value",
          output: [],
          pid: 1,
          signal: null,
        };
      },
    );

    const result = cli.run(["find-generic-password", "-a", "openai-work"]);

    expect(calls).toEqual([
      {
        command: "security",
        args: ["find-generic-password", "-a", "openai-work"],
        options: { encoding: "utf8" },
      },
    ]);
    expect(result).toEqual({
      exitCode: 0,
      stdout: "stdout-value",
      stderr: "stderr-value",
    });
  });
});
