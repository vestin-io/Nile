import { describe, expect, it } from "vitest";

import { CONNECTION_APPLY_REQUIREMENTS } from "./Requirements";

describe("ConnectionApplyRequirementsReader", () => {
  it("requires both a selected model and env-backed key for openclaw api-key connections", () => {
    expect(CONNECTION_APPLY_REQUIREMENTS.read({
      agentId: "openclaw",
      authMode: "api_key",
      envKey: null,
      selectedModelId: null,
    })).toEqual({
      canApply: false,
      requirements: [
        { kind: "selected-model" },
        { kind: "env-backed-api-key" },
      ],
    });
  });

  it("allows non-openclaw shared connections without extra requirements", () => {
    expect(CONNECTION_APPLY_REQUIREMENTS.read({
      agentId: "codex",
      authMode: "openai_session",
      envKey: null,
      selectedModelId: null,
    })).toEqual({
      canApply: true,
      requirements: [],
    });
  });

  it("requires only env-backed key when openclaw already has a selected model", () => {
    expect(CONNECTION_APPLY_REQUIREMENTS.read({
      agentId: "openclaw",
      authMode: "api_key",
      envKey: null,
      selectedModelId: "gpt-5.3-codex",
    })).toEqual({
      canApply: false,
      requirements: [
        { kind: "env-backed-api-key" },
      ],
    });
  });
});
