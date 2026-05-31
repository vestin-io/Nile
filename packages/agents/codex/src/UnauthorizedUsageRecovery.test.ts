import { describe, expect, it, vi } from "vitest";

import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";

import { CodexUnauthorizedUsageRecovery } from "./UnauthorizedUsageRecovery";

describe("CodexUnauthorizedUsageRecovery", () => {
  it("re-signs into the live Codex home with the desktop browser opener", async () => {
    const signInAndRead = vi.fn(async () => ({
      kind: "openai_session",
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accountId: "acct-123",
    }));
    const openExternalUrl = vi.fn(async () => {});
    const recovery = new CodexUnauthorizedUsageRecovery(
      () => ({ signInAndRead }) as never,
    );

    await recovery.recover("/tmp/.codex", {
      agentHomes: undefined,
      agentRuntimeCommandOverrides: {
        codex: "/opt/bin/codex",
      },
      environment: EnvironmentSource.empty(),
      openExternalUrl,
    });

    expect(signInAndRead).toHaveBeenCalledWith("/tmp/.codex", {
      commandPathOverride: "/opt/bin/codex",
      openExternalUrl,
    });
  });
});
