import { describe, expect, it, vi } from "vitest";

import { DesktopEnvironmentSource } from "./Source";

describe("DesktopEnvironmentSource", () => {
  it("falls back to process values when the managed store throws", () => {
    const source = new DesktopEnvironmentSource(
      { OPENAI_API_KEY: "fallback-secret" },
      {
        read: vi.fn(() => {
          throw new Error("keychain unavailable");
        }),
      } as never,
    );

    expect(source.read("OPENAI_API_KEY")).toBe("fallback-secret");
  });
});
