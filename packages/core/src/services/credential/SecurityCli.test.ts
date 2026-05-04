import { describe, expect, it } from "vitest";

import { SecurityCli } from "./SecurityCli";

describe("SecurityCli", () => {
  it("rewrites prompt-based secret writes to direct password args", () => {
    const calls: Array<{ command: string; args: readonly string[]; options: { encoding: "utf8"; input?: string } }> = [];
    const cli = new SecurityCli((command, args, options) => {
      calls.push({ command, args, options });
      return {
        status: 0,
        stdout: "",
        stderr: "",
        output: [],
        pid: 1,
        signal: null,
      };
    });

    cli.runWithSecretData([
      "add-generic-password",
      "-a",
      "openai-work",
      "-s",
      "nile.test",
      "-w",
    ], "secret-value");

    expect(calls).toEqual([
      {
        command: "security",
        args: [
          "add-generic-password",
          "-a",
          "openai-work",
          "-s",
          "nile.test",
          "-w",
          "secret-value",
        ],
        options: { encoding: "utf8" },
      },
    ]);
  });
});
