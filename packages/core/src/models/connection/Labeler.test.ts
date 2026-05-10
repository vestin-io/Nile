import { describe, expect, it } from "vitest";

import { type StoredCredential } from "../../services/credential/Types";
import { ConnectionLabeler } from "./Labeler";

describe("ConnectionLabeler", () => {
  it("suggests endpoint labels for gateway-style families", () => {
    const labeler = new ConnectionLabeler();

    expect(labeler.suggestEndpointLabel("gateway", {
      endpointUrl: "https://router.example/v1",
    })).toBe("Gateway (router.example)");
    expect(labeler.suggestEndpointLabel("azure-openai", {
      endpointUrl: "https://example.cognitiveservices.azure.com/openai/v1",
    })).toBe("Azure OpenAI (example)");
    expect(labeler.suggestEndpointLabel("anthropic", {
      endpointUrl: "https://gateway.example.test/v1",
    })).toBe("Claude Gateway");
  });

  it("resolves human labels from session credentials when possible", () => {
    const labeler = new ConnectionLabeler();

    expect(labeler.resolveSuggestedAccessLabel(
      "openai",
      "openai_session",
      openAiSessionCredential("work@example.com"),
    )).toBe("work@example.com");

    expect(labeler.resolveSuggestedAccessLabel(
      "openai",
      "cursor_session",
      cursorSessionCredential("auth0|user_123", "cursor.user@example.com"),
    )).toBe("cursor.user@example.com");
  });

  it("falls back to generated api-key labels", () => {
    const labeler = new ConnectionLabeler();

    expect(labeler.suggestAccessLabel(
      "gateway",
      "api_key",
      { kind: "api_key", apiKey: "router-secret" },
      { endpointUrl: "https://router.example/v1" },
    )).toBe("Gateway (router.example) API Key");

    expect(labeler.suggestAccessLabel(
      "azure-openai",
      "api_key",
      { kind: "api_key", apiKey: "azure-secret" },
      { endpointUrl: "https://example.cognitiveservices.azure.com/openai/v1" },
    )).toBe("example API Key");
  });
});

function openAiSessionCredential(email: string): StoredCredential {
  return {
    kind: "openai_session",
    idToken: createIdToken(email),
    accessToken: "access-token",
    refreshToken: "refresh-token",
    accountId: "acct-123",
    lastRefresh: "2026-04-25T00:00:00.000Z",
  };
}

function cursorSessionCredential(authId: string, email: string): StoredCredential {
  return {
    kind: "cursor_session",
    accessToken: "cursor-access-token",
    refreshToken: "cursor-refresh-token",
    authId,
    authCacheKey: `auth:${authId}`,
    email,
    displayName: "Cursor User",
    userId: 247015891,
  };
}

function createIdToken(email: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" }), "utf8")
    .toString("base64url");
  const payload = Buffer.from(JSON.stringify({ email }), "utf8").toString("base64url");
  return `${header}.${payload}.signature`;
}
