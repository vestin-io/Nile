import { describe, expect, it, vi } from "vitest";

import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";

import { GeminiUnauthorizedUsageRecovery } from "./UnauthorizedUsageRecovery";

describe("GeminiUnauthorizedUsageRecovery", () => {
  it("falls back to sign-in when Gemini refresh starts an interactive reauth flow", async () => {
    const refresh = {
      refresh: vi.fn(async () => {
        throw new Error(
          "Gemini CLI token refresh timed out. CLI output: Opening authentication page in your browser. Do you want to continue? [Y/n]:",
        );
      }),
    } as never;
    const signInAndRead = vi.fn(async () => ({
      kind: "gemini_cli_session",
      accessToken: "fresh-access",
      refreshToken: "fresh-refresh",
      idToken: "fresh-id",
    }));
    const recovery = new GeminiUnauthorizedUsageRecovery(
      refresh,
      () => ({ signInAndRead }) as never,
    );

    await recovery.recover("/tmp/.gemini", {
      agentHomes: undefined,
      agentRuntimeCommandOverrides: {
        gemini: "/opt/bin/gemini",
      },
      environment: EnvironmentSource.empty(),
    });

    expect(signInAndRead).toHaveBeenCalledWith("/tmp/.gemini", {
      commandPathOverride: "/opt/bin/gemini",
    });
  });

  it("rethrows refresh failures that are not re-login candidates", async () => {
    const refresh = {
      refresh: vi.fn(async () => {
        throw new Error("Gemini CLI token refresh failed with exit code 55. CLI output: network unavailable");
      }),
    } as never;
    const recovery = new GeminiUnauthorizedUsageRecovery(
      refresh,
      () => ({ signInAndRead: vi.fn() }) as never,
    );

    await expect(recovery.recover("/tmp/.gemini", {
      agentHomes: undefined,
      environment: EnvironmentSource.empty(),
    })).rejects.toThrow("network unavailable");
  });
});
