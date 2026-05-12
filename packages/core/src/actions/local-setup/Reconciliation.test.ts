import { describe, expect, it } from "vitest";

import type { AgentDetectionResult } from "../../models/agent";
import { AGENT_SETUP_RECONCILIATION } from "./Reconciliation";

describe("AgentSetupReconciliationReader", () => {
  it("treats matched setups as already saved", () => {
    expect(
      AGENT_SETUP_RECONCILIATION.read(createDetection({ validity: "valid_matched" })),
    ).toEqual({
      state: "already_saved",
      hasLiveSetup: true,
    });
  });

  it("treats import candidates as new", () => {
    expect(
      AGENT_SETUP_RECONCILIATION.read(createDetection({ validity: "valid_import_candidate" })),
    ).toEqual({
      state: "new",
      hasLiveSetup: true,
    });
  });

  it("treats empty invalid detections as unavailable", () => {
    expect(
      AGENT_SETUP_RECONCILIATION.read(createDetection({
        validity: "invalid_structure",
        endpoint: null,
        access: null,
        matchedConnection: null,
        issues: [],
      })),
    ).toEqual({
      state: "unavailable",
      hasLiveSetup: false,
    });
  });
});

function createDetection(
  overrides: Partial<AgentDetectionResult["detectedState"]> = {},
): AgentDetectionResult {
  return {
    agentSelection: null,
    detectedState: {
      agentId: "codex",
      validity: "valid_unverified",
      issues: [],
      endpoint: {
        endpointFamily: "openai",
        endpointIdHint: "openai",
        labelHint: "OpenAI",
      },
      access: {
        authMode: "api_key",
        labelHint: "Work",
      },
      matchedConnection: {
        connectionId: "work",
        endpointId: "openai",
        accessId: "work",
        matchesAgentSelection: true,
      },
      ...overrides,
    },
  };
}
