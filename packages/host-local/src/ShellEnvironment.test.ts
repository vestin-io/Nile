import { describe, expect, it } from "vitest";

import { ShellEnvironment } from "./ShellEnvironment";

describe("ShellEnvironment", () => {
  it("merges login-shell values over the current process environment", () => {
    const execFile = (((_file, _args, options) => {
      expect(options?.env?.NILE_SWITCHER_MANAGED_ENV_LOADED).toBe("1");
      return "OPENAI_API_KEY=from-shell\nPATH=/usr/local/bin\n";
    }) as typeof import("node:child_process").execFileSync);
    const environment = new ShellEnvironment(execFile);

    expect(environment.readLoginShellEnvironment()).toEqual(
      expect.objectContaining({
        OPENAI_API_KEY: "from-shell",
        PATH: "/usr/local/bin",
      }),
    );
  });
});
