import { describe, expect, it } from "vitest";

import { ConnectionIdentityKeyResolver } from "./IdentityKeyResolver";

describe("ConnectionIdentityKeyResolver", () => {
  it("reads an OpenAI session identity key from the openai-session family", () => {
    const resolver = new ConnectionIdentityKeyResolver();

    expect(resolver.resolve("openai_session", {
      kind: "openai_session",
      idToken: buildJwt({ sub: "sub-123", email: "jay@example.com" }),
      accessToken: "access-token",
      refreshToken: "refresh-token",
    })).toBe("subject:sub-123");
  });

  it("reads a Gemini CLI session identity key from the gemini family", () => {
    const resolver = new ConnectionIdentityKeyResolver();

    expect(resolver.resolve("gemini_cli_session", {
      kind: "gemini_cli_session",
      idToken: buildJwt({ sub: "google-sub-1", email: "jay@example.com" }),
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiryDate: Date.now() + 60_000,
    })).toBe("google-sub:google-sub-1");
  });
});

function buildJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `header.${encoded}.signature`;
}
