import { describe, expect, it } from "vitest";

import { ConnectionOnboardingPolicy } from "./OnboardingPolicy";

describe("ConnectionOnboardingPolicy", () => {
  it("suggests OpenClaw and OpenCode for generic gateways that support OpenAI-compatible or Anthropic protocols", () => {
    const policy = new ConnectionOnboardingPolicy();

    const suggestion = policy.suggest("gateway", {
      id: "gateway-example",
      label: "Gateway (example)",
      rootUrl: "https://gateway.example.test",
      profile: "generic-gateway",
      protocols: {
        openai: {
          basePath: "/v1",
          wireApis: ["responses"],
          authSchemes: ["bearer"],
        },
        anthropic: {
          authSchemes: ["bearer"],
          basePath: "/v1",
          versionHeader: "2023-06-01",
        },
      },
    });

    expect(suggestion.configurableAgents).toEqual(["codex", "claude", "openclaw", "opencode"]);
    expect(suggestion.defaultEnabledAgents).toEqual(["codex", "claude", "openclaw", "opencode"]);
  });

  it("suggests Cursor only when the gateway exposes cursor protocol", () => {
    const policy = new ConnectionOnboardingPolicy();

    const suggestion = policy.suggest("gateway", {
      id: "gateway-cursor",
      label: "Gateway (cursor)",
      rootUrl: "https://gateway.cursor.test",
      profile: "generic-gateway",
      protocols: {
        cursor: {
          backendPath: "/cursor",
        },
      },
    });

    expect(suggestion.configurableAgents).toEqual(["cursor"]);
    expect(suggestion.defaultEnabledAgents).toEqual(["cursor"]);
  });
});
