import { describe, expect, it } from "vitest";

import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { CodexSessionLogin } from "./CodexSessionLogin";

describe("CodexSessionLogin", () => {
  it("prefers the current process PATH and appends login-shell PATH entries", async () => {
    let receivedPath: string | undefined;
    const originalPath = process.env.PATH;
    process.env.PATH = "/Users/test/.nvm/bin:/usr/bin";
    const login = new CodexSessionLogin(
      EnvironmentSource.from({ PATH: "/opt/homebrew/bin:/usr/bin:/usr/local/bin" }),
      (_command, _args, options) => {
        receivedPath = options?.env?.PATH;
        return {
          once(event: "error" | "exit", listener: ((error: Error) => void) | ((code: number | null) => void)) {
            if (event === "exit") {
              (listener as (code: number | null) => void)(0);
            }
            return this;
          },
        } as never;
      },
    );

    try {
      await login.signIn("/tmp/.codex");
    } finally {
      process.env.PATH = originalPath;
    }

    expect(receivedPath).toBe("/Users/test/.nvm/bin:/usr/bin:/opt/homebrew/bin:/usr/local/bin");
  });

  it("returns a user-facing error when the codex CLI is missing from PATH", async () => {
    const login = new CodexSessionLogin(
      EnvironmentSource.empty(),
      () => ({
        once(event: "error" | "exit", listener: ((error: Error) => void) | ((code: number | null) => void)) {
          if (event === "error") {
            (listener as (error: Error) => void)(Object.assign(new Error("spawn codex ENOENT"), { code: "ENOENT" }));
          }
          return this;
        },
      }) as never,
    );

    await expect(login.signIn("/tmp/.codex")).rejects.toThrow(
      "Codex CLI was not found in PATH. Install Codex CLI or add it to your shell PATH, then restart Nile.",
    );
  });
});
