import { describe, expect, it } from "vitest";

import { GenericPasswordWriter } from "./GenericPasswordWriter";

describe("GenericPasswordWriter", () => {
  it("writes generic passwords through the native helper and stdin", () => {
    const calls: Array<{ command: string; args: readonly string[]; options: { encoding: "utf8"; input?: string } }> = [];
    const writer = new GenericPasswordWriter(
      (command, args, options) => {
        calls.push({ command, args, options });
        return {
          status: 0,
          stdout: "",
          stderr: "",
          output: [],
          pid: 1,
          signal: null,
        };
      },
      () => "/tmp/nile-keychain-helper",
    );

    const result = writer.write({
      account: "openai-work",
      service: "nile.test",
      secret: "secret-value",
      update: true,
    });

    expect(calls).toEqual([
      {
        command: "/tmp/nile-keychain-helper",
        args: [
          "write-generic-password",
          "--account",
          "openai-work",
          "--service",
          "nile.test",
          "--mode",
          "upsert",
        ],
        options: { encoding: "utf8", input: "secret-value" },
      },
    ]);
    expect(result).toEqual({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });
  });
});
