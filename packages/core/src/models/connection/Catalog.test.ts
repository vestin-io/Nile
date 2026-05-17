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
        iconKey: "openai",
        supportedAuthModes: ["openai_session", "api_key"],
        requiresEndpointUrl: false,
        configurableAgents: ["codex", "openclaw"],
        selectableAgents: ["codex", "openclaw"],
        defaultEnabledAgents: ["codex"],
        supportsEnvKey: true,
        suggestEnabledAgents: false,
      },
      {
        preset: "gateway",
        label: "Gateway",
        iconKey: "gateway",
        supportedAuthModes: ["api_key"],
        requiresEndpointUrl: true,
        configurableAgents: [...SUPPORTED_AGENT_IDS],
        selectableAgents: ["codex", "cursor", "claude", "openclaw"],
        defaultEnabledAgents: ["codex", "claude"],
        supportsEnvKey: true,
        suggestEnabledAgents: true,
      },
      {
        preset: "cursor",
        label: "Cursor",
        iconKey: "cursor",
        supportedAuthModes: ["cursor_session"],
        requiresEndpointUrl: false,
        configurableAgents: ["cursor"],
        selectableAgents: ["cursor"],
        defaultEnabledAgents: ["cursor"],
        supportsEnvKey: false,
        suggestEnabledAgents: false,
      },
      {
        preset: "azure-openai",
        label: "Azure OpenAI",
        iconKey: "azure-openai",
        supportedAuthModes: ["api_key"],
        requiresEndpointUrl: true,
        configurableAgents: ["codex", "openclaw"],
        selectableAgents: ["codex", "openclaw"],
        defaultEnabledAgents: ["codex"],
        supportsEnvKey: true,
        suggestEnabledAgents: false,
      },
      {
        preset: "anthropic",
        label: "Official Claude",
        iconKey: "anthropic",
        supportedAuthModes: ["api_key", "claude_session"],
        requiresEndpointUrl: false,
        configurableAgents: ["claude", "openclaw"],
        selectableAgents: ["claude", "openclaw"],
        defaultEnabledAgents: ["claude"],
        supportsEnvKey: true,
        suggestEnabledAgents: false,
      },
      {
        preset: "gemini",
        label: "Gemini CLI",
        iconKey: "gemini",
        supportedAuthModes: ["gemini_cli_session"],
        requiresEndpointUrl: false,
        configurableAgents: ["gemini"],
        selectableAgents: ["gemini"],
        defaultEnabledAgents: ["gemini"],
        supportsEnvKey: false,
        suggestEnabledAgents: false,
      },
    ]);
  });

  it("returns null when a preset is unsupported", () => {
    const catalog = new ConnectionCatalog();

    expect(catalog.getDefinition("unsupported")).toBeNull();
  });
});
