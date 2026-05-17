import { describe, expect, it } from "vitest";

import { canConfigureAgent, readDefinitionsForAgent, type Definition } from "./DesktopData";

describe("readDefinitionsForAgent", () => {
  const definitions: Definition[] = [
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
      configurableAgents: ["codex", "cursor", "claude", "gemini", "openclaw"],
      selectableAgents: ["codex", "cursor", "claude", "openclaw"],
      defaultEnabledAgents: ["codex", "claude"],
      supportsEnvKey: false,
      suggestEnabledAgents: true,
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
  ];

  it("scopes Gemini add-connection definitions to Gemini-only providers", () => {
    expect(readDefinitionsForAgent(definitions, "gemini").map((definition) => definition.preset)).toEqual([
      "gemini",
    ]);
  });

  it("treats Gemini as configurable because it has a real selectable provider", () => {
    expect(canConfigureAgent(definitions, "gemini")).toBe(true);
  });

  it("shows both Cursor and Gateway for Cursor-scoped add connection", () => {
    expect(readDefinitionsForAgent(definitions, "cursor").map((definition) => definition.preset)).toEqual([
      "gateway",
      "cursor",
    ]);
  });
});
