import { describe, expect, it } from "vitest";

import { ConnectionAgentPolicy } from "./AgentPolicy";

describe("ConnectionAgentPolicy", () => {
  it("allows OpenClaw for official session-backed providers", () => {
    const policy = new ConnectionAgentPolicy();

    expect(policy.supportsAgent({ preset: "openai", authMode: "openai_session", agentId: "openclaw" })).toBe(true);
    expect(policy.supportsAgent({ preset: "anthropic", authMode: "claude_session", agentId: "openclaw" })).toBe(true);
  });

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

  it("derives saved gateway configurable agents from detected protocols", () => {
    const policy = new ConnectionAgentPolicy();

    expect(policy.readSavedConnectionConfig({
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
      },
      authMode: "api_key",
    })).toEqual({
      configurableAgents: ["codex", "openclaw"],
      defaultEnabledAgents: ["codex", "openclaw"],
    });
  });
});
