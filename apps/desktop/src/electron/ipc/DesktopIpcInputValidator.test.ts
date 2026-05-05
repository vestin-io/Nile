import { describe, expect, it } from "vitest";

import { DesktopIpcInputValidator } from "./DesktopIpcInputValidator";

describe("DesktopIpcInputValidator", () => {
  it("accepts a valid add-connection payload", () => {
    const validator = new DesktopIpcInputValidator();

    expect(validator.readAddConnectionInput({
      preset: "gateway",
      authMode: "api_key",
      endpointUrl: "https://gateway.example/v1",
      enabledAgents: ["codex", "openclaw"],
      apiKeySource: "env_key",
      envKey: "OPENAI_API_KEY",
      allowUndetectedGateway: true,
    })).toEqual(expect.objectContaining({
      preset: "gateway",
      authMode: "api_key",
      endpointUrl: "https://gateway.example/v1",
      enabledAgents: ["codex", "openclaw"],
      apiKeySource: "env_key",
      envKey: "OPENAI_API_KEY",
      allowUndetectedGateway: true,
    }));
  });

  it("rejects unsupported enum values", () => {
    const validator = new DesktopIpcInputValidator();

    expect(() => validator.readAddConnectionInput({
      preset: "gateway",
      authMode: "oauth",
    })).toThrow("authMode is not supported");

    expect(() => validator.readAddConnectionInput({
      preset: "unknown-provider",
      authMode: "api_key",
    })).toThrow("preset is not supported");
  });

  it("rejects invalid agent arrays", () => {
    const validator = new DesktopIpcInputValidator();

    expect(() => validator.readAgentIds(["codex", "bad-agent"], "scanIds"))
      .toThrow("scanIds[1] is not a supported agent");
  });

  it("does not coerce scalar values", () => {
    const validator = new DesktopIpcInputValidator();

    expect(() => validator.readUpdateConnectionInput({
      connectionId: "openai-work",
      syncSelectedAgents: "true",
    })).toThrow("syncSelectedAgents must be a boolean");
  });
});
