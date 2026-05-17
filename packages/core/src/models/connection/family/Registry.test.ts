import { describe, expect, it } from "vitest";

import { CONNECTION_FAMILY_REGISTRY } from "./Registry";
import { listCurrentSessionSourceManifests } from "../../../session/Registry";

describe("ConnectionFamilyRegistry", () => {
  it("registers all built-in connection families", () => {
    expect(CONNECTION_FAMILY_REGISTRY.list().map((m) => m.id)).toHaveLength(8);
  });

  it("owns Gemini CLI session family metadata", () => {
    expect(CONNECTION_FAMILY_REGISTRY.read("gemini-cli-session")).toMatchObject({
      id: "gemini-cli-session",
      authMode: "gemini_cli_session",
      protocol: "gemini",
      selectablePresets: ["gemini"],
      currentSessionSourceIds: ["current_gemini"],
    });
  });

  it("owns session-specific matching and labeling behavior", () => {
    expect(CONNECTION_FAMILY_REGISTRY.readModule("openai-session").behaviors.identityKeyReader).toBeTruthy();
    expect(CONNECTION_FAMILY_REGISTRY.readModule("openai-session").behaviors.openAiSessionModelCatalogReader).toBeTruthy();
    expect(CONNECTION_FAMILY_REGISTRY.readModule("claude-session").behaviors.identityKeyReader).toBeTruthy();
    expect(CONNECTION_FAMILY_REGISTRY.readModule("claude-session").behaviors.accessMatcher).toBeTruthy();
  });

  it("derives saved and selectable families from auth mode and protocol state", () => {
    expect(CONNECTION_FAMILY_REGISTRY.readSavedFamilyIds({
      authMode: "claude_session",
      protocols: {
        anthropic: {
          authSchemes: ["bearer"],
        },
      },
    })).toEqual(["claude-session"]);

    expect(CONNECTION_FAMILY_REGISTRY.readSelectableFamilyIds({
      authMode: "api_key",
      preset: "gateway",
    })).toEqual(["openai-api-key", "anthropic-api-key", "cursor-api-key"]);
  });

  it("owns current local session source ids at the family layer", () => {
    for (const source of listCurrentSessionSourceManifests()) {
      expect(CONNECTION_FAMILY_REGISTRY.readCurrentSessionSourceIds(source.familyId)).toContain(source.id);
    }
  });
});
