import { describe, expect, it } from "vitest";

import { GenericPasswordWriter, readHelperPathCandidates } from "./GenericPasswordWriter";

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

  it("prefers unpacked helper paths before asar paths in packaged builds", () => {
    expect(
      readHelperPathCandidates("/Applications/Nile.app/Contents/Resources/app.asar/dist/electron"),
    ).toEqual([
      "/Applications/Nile.app/Contents/Resources/app.asar.unpacked/dist/electron/KeychainGenericPasswordHelper",
      "/Applications/Nile.app/Contents/Resources/app.asar/dist/electron/KeychainGenericPasswordHelper",
      "/Applications/Nile.app/Contents/Resources/dist/services/credential/KeychainGenericPasswordHelper",
    ]);
  });
});
