import { describe, expect, it } from "vitest";

import { LOCAL_SETUP_PRESENTATION } from "./LocalSetup";

describe("LocalSetupPresentation", () => {
  it("keeps already-saved detected setups visible for quick setup completion states", () => {
    expect(LOCAL_SETUP_PRESENTATION.shouldShowDetectedSetup({
      agentId: "claude",
      defaultSelected: false,
      importable: false,
      issues: [],
      reconciliationState: "already_saved",
      scanId: "claude",
      subtitle: "Gateway (llmfk.dpdns.org) • api_key",
      title: "Claude · Gateway (llmfk.dpdns.org) API Key",
    })).toBe(true);
  });

  it("keeps new detected setups visible", () => {
    expect(LOCAL_SETUP_PRESENTATION.shouldShowDetectedSetup({
      agentId: "claude",
      defaultSelected: true,
      importable: true,
      issues: [],
      reconciliationState: "new",
      scanId: "claude",
      subtitle: "Gateway (llmfk.dpdns.org) • api_key",
      title: "Claude · Gateway (llmfk.dpdns.org) API Key",
    })).toBe(true);
  });
});
