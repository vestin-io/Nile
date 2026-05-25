import { describe, expect, it } from "vitest";

import { SUPPORTED_AGENT_IDS } from "@nile/core/models/agent/definitions";

import { parseDesktopPreferences } from "./DesktopPreferences";

describe("DesktopPreferences", () => {
  it("keeps the default system theme when stored values are invalid", () => {
    expect(parseDesktopPreferences(JSON.stringify({
      theme: "sepia",
    })).theme).toBe("system");
  });

  it("includes every supported agent in the default order", () => {
    expect(parseDesktopPreferences(null).agentOrder).toEqual(SUPPORTED_AGENT_IDS);
  });

  it("appends newly supported agents to stored preferences", () => {
    expect(parseDesktopPreferences(JSON.stringify({
      agentOrder: ["codex", "claude", "cursor", "openclaw"],
    })).agentOrder).toEqual(["codex", "claude", "cursor", "openclaw", "gemini"]);
  });

  it("preserves normalized connection quota metric preferences", () => {
    expect(parseDesktopPreferences(JSON.stringify({
      connectionQuotaMetricPreferences: {
        " codex-work ": " weekly ",
        "cursor-work": "",
      },
    })).connectionQuotaMetricPreferences).toEqual({
      "codex-work": "weekly",
    });
  });

  it("keeps a valid credential storage mode", () => {
    expect(parseDesktopPreferences(JSON.stringify({
      credentialStorageMode: "encrypted_local_storage",
    })).credentialStorageMode).toBe("encrypted_local_storage");
  });

  it("drops an invalid credential storage mode", () => {
    expect(parseDesktopPreferences(JSON.stringify({
      credentialStorageMode: "plaintext_file",
    })).credentialStorageMode).toBeNull();
  });
});
