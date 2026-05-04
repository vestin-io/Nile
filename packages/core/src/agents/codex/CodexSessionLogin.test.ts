import { describe, expect, it } from "vitest";

import { EnvironmentSource } from "../../services/EnvironmentSource";
import { CodexSessionLogin } from "./CodexSessionLogin";

describe("CodexSessionLogin", () => {
  it("passes login-shell PATH through to the spawned codex command", () => {
    let receivedPath: string | undefined;
    const login = new CodexSessionLogin(
      EnvironmentSource.from({ PATH: "/opt/homebrew/bin:/usr/local/bin" }),
      (_command, _args, options) => {
        receivedPath = options?.env?.PATH;
        return {
          status: 0,
        };
      },
    );

    login.signIn("/tmp/.codex");

    expect(receivedPath).toBe("/opt/homebrew/bin:/usr/local/bin");
  });

  it("returns a user-facing error when the codex CLI is missing from PATH", () => {
    const login = new CodexSessionLogin(
      EnvironmentSource.empty(),
      () => ({
        status: null,
        error: Object.assign(new Error("spawnSync codex ENOENT"), { code: "ENOENT" }),
      }),
    );

    expect(() => login.signIn("/tmp/.codex")).toThrow(
      "Codex CLI was not found in PATH. Install Codex CLI or add it to your shell PATH, then restart Nile.",
    );
  });
});
