import { describe, expect, it } from "vitest";

import { SUPPORTED_AGENT_IDS } from "../agent";
import { ConnectionCatalog } from "./Catalog";

describe("ConnectionCatalog", () => {
  it("lists the supported connection families from core", () => {
    const catalog = new ConnectionCatalog();

    expect(catalog.listDefinitions()).toEqual([
      {
        preset: "openai",
        label: "Official OpenAI",
        supportedAuthModes: ["openai_session", "api_key"],
        requiresEndpointUrl: false,
        configurableAgents: ["codex"],
        defaultEnabledAgents: ["codex"],
        supportsEnvKey: true,
        suggestEnabledAgents: false,
      },
      {
        preset: "gateway",
        label: "Gateway",
        supportedAuthModes: ["api_key"],
        requiresEndpointUrl: true,
        configurableAgents: [...SUPPORTED_AGENT_IDS],
        defaultEnabledAgents: ["codex", "claude"],
        supportsEnvKey: true,
        suggestEnabledAgents: true,
      },
      {
        preset: "azure-openai",
        label: "Azure OpenAI",
        supportedAuthModes: ["api_key"],
        requiresEndpointUrl: true,
        configurableAgents: ["codex"],
        defaultEnabledAgents: ["codex"],
        supportsEnvKey: true,
        suggestEnabledAgents: false,
      },
      {
        preset: "anthropic",
        label: "Official Claude",
        supportedAuthModes: ["api_key", "claude_session"],
        requiresEndpointUrl: false,
        configurableAgents: ["claude"],
        defaultEnabledAgents: ["claude"],
        supportsEnvKey: true,
        suggestEnabledAgents: false,
      },
    ]);
  });

  it("returns null when a preset is unsupported", () => {
    const catalog = new ConnectionCatalog();

    expect(catalog.getDefinition("unsupported")).toBeNull();
  });
});
