import { describe, expect, it } from "vitest";

import { ShellEnvironment } from "./ShellEnvironment";

describe("ShellEnvironment", () => {
  it("merges login-shell values over the current process environment", () => {
    const environment = new ShellEnvironment(((_file, _args, _options) =>
      "OPENAI_API_KEY=from-shell\nPATH=/usr/local/bin\n"
    ) as typeof import("node:child_process").execFileSync);

    expect(environment.readLoginShellEnvironment()).toEqual(
      expect.objectContaining({
        OPENAI_API_KEY: "from-shell",
        PATH: "/usr/local/bin",
      }),
    );
  });
});
