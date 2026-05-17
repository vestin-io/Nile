import { describe, expect, it } from "vitest";

import { SUPPORTED_AGENT_IDS } from "../Ids";
import { AGENT_CAPABILITIES } from "./Capabilities";

describe("AgentCapabilities", () => {
  it("registers explicit capabilities for every supported agent", () => {
    expect(AGENT_CAPABILITIES.listConfiguredAgentIds().sort()).toEqual([...SUPPORTED_AGENT_IDS].sort());
  });

  it("marks openclaw as requiring a selected model and env-backed api keys", () => {
    expect(AGENT_CAPABILITIES.read("openclaw")).toEqual({
      iconKey: "openclaw",
      requiredApplyRequirements: ["selected-model", "env-backed-api-key"],
      supportsManagedEnvBackedApiKey: true,
      supportedConnectionFamilyIds: [
        "openai-api-key",
        "anthropic-api-key",
        "openai-session",
        "openclaw-openai-session",
        "claude-session",
      ],
      autoSyncMatchedSelection: false,
      connectionEntryMode: "configure_or_import",
    });
  });

  it("keeps codex capability requirements minimal", () => {
    expect(AGENT_CAPABILITIES.read("codex")).toEqual({
      iconKey: "codex",
      requiredApplyRequirements: [],
      supportsManagedEnvBackedApiKey: true,
      supportedConnectionFamilyIds: ["openai-api-key", "openai-session"],
      autoSyncMatchedSelection: true,
      connectionEntryMode: "configure_or_import",
    });
  });

  it("marks Gemini as configurable through the shared connection add flow", () => {
    expect(AGENT_CAPABILITIES.read("gemini").connectionEntryMode).toBe("configure_or_import");
  });

  it("detects saved gateway compatibility for openclaw from openai or anthropic protocols", () => {
    expect(AGENT_CAPABILITIES.supportsSavedConnection("openclaw", {
      protocols: { openai: { wireApis: ["responses"], authSchemes: ["bearer"] } },
      authMode: "api_key",
    })).toBe(true);
    expect(AGENT_CAPABILITIES.supportsSavedConnection("openclaw", {
      protocols: { anthropic: { authSchemes: ["bearer"] } },
      authMode: "api_key",
    })).toBe(true);
  });

  it("supports gateway selectable connections through shared connection kinds", () => {
    expect(AGENT_CAPABILITIES.supportsSelectableConnection("codex", {
      preset: "gateway",
      authMode: "api_key",
    })).toBe(true);
    expect(AGENT_CAPABILITIES.supportsSelectableConnection("claude", {
      preset: "gateway",
      authMode: "api_key",
    })).toBe(true);
    expect(AGENT_CAPABILITIES.supportsSelectableConnection("cursor", {
      preset: "gateway",
      authMode: "api_key",
    })).toBe(true);
    expect(AGENT_CAPABILITIES.supportsSelectableConnection("cursor", {
      preset: "cursor",
      authMode: "cursor_session",
    })).toBe(true);
  });
});
