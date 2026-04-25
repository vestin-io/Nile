import { describe, expect, it } from "vitest";

import { LocalCredentialRequestBuilder } from "./LocalCredentialRequestBuilder";

describe("LocalCredentialRequestBuilder", () => {
  it("builds direct api key requests", () => {
    const builder = new LocalCredentialRequestBuilder();

    expect(builder.build({
      authMode: "api_key",
      apiKeySource: "direct",
      apiKey: "secret",
    })).toEqual({
      authMode: "api_key",
      source: "direct",
      apiKey: "secret",
    });
  });

  it("builds env-key api key requests", () => {
    const builder = new LocalCredentialRequestBuilder();

    expect(builder.build({
      authMode: "api_key",
      apiKeySource: "env_key",
      envKey: "OPENAI_API_KEY",
    })).toEqual({
      authMode: "api_key",
      source: "env_key",
      envKey: "OPENAI_API_KEY",
    });
  });

  it("builds openai session requests with a custom auth path", () => {
    const builder = new LocalCredentialRequestBuilder();

    expect(builder.build({
      authMode: "openai_session",
      openAiSessionSource: "current_codex",
      openAiAuthJsonPath: "/tmp/auth.json",
    })).toEqual({
      authMode: "openai_session",
      source: "current_codex",
      authJsonPath: "/tmp/auth.json",
    });
  });

  it("builds optional update requests only when the update payload is complete", () => {
    const builder = new LocalCredentialRequestBuilder();

    expect(builder.buildUpdate("api_key", {
      apiKeySource: "env_key",
    })).toBeUndefined();

    expect(builder.buildUpdate("claude_session", {
      claudeSessionSource: "current_claude",
    })).toEqual({
      authMode: "claude_session",
      source: "current_claude",
    });
  });
});
