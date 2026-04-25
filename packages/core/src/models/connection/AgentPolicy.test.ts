import { describe, expect, it } from "vitest";

import { ConnectionAgentPolicy } from "./AgentPolicy";

describe("ConnectionAgentPolicy", () => {
  it("allows env-backed api keys for supported api-key providers", () => {
    const policy = new ConnectionAgentPolicy();

    expect(policy.supportsEnvKeySource({ preset: "openai", authMode: "api_key" })).toBe(true);
    expect(policy.supportsEnvKeySource({ preset: "azure-openai", authMode: "api_key" })).toBe(true);
    expect(policy.supportsEnvKeySource({ preset: "anthropic", authMode: "api_key" })).toBe(true);
    expect(policy.supportsEnvKeySource({ preset: "gateway", authMode: "api_key" })).toBe(true);
  });

  it("rejects env-backed credentials for non-api-key flows", () => {
    const policy = new ConnectionAgentPolicy();

    expect(policy.supportsEnvKeySource({ preset: "openai", authMode: "openai_session" })).toBe(false);
    expect(policy.supportsEnvKeySource({ preset: "anthropic", authMode: "claude_session" })).toBe(false);
  });
});
