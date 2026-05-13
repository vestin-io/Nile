import { describe, expect, it } from "vitest";

import { CONNECTION_SUPPORT_KINDS } from "./Support";

describe("ConnectionSupportKinds", () => {
  it("derives saved kinds for saved credentials", () => {
    expect(CONNECTION_SUPPORT_KINDS.readSavedKinds({
      authMode: "api_key",
      protocols: {
        openai: {
          authSchemes: ["bearer"],
          wireApis: ["responses"],
        },
      },
    })).toEqual(["openai-api-key"]);

    expect(CONNECTION_SUPPORT_KINDS.readSavedKinds({
      authMode: "openai_session",
      protocols: {
        openai: {
          authSchemes: ["bearer"],
          wireApis: ["responses"],
        },
      },
    })).toEqual(["openai-session"]);
  });

  it("derives selectable kinds for onboarding flows", () => {
    expect(CONNECTION_SUPPORT_KINDS.readSelectableKinds({
      preset: "gateway",
      authMode: "api_key",
    })).toEqual(["openai-api-key", "anthropic-api-key", "cursor-api-key"]);

    expect(CONNECTION_SUPPORT_KINDS.readSelectableKinds({
      preset: "openai",
      authMode: "openai_session",
    })).toEqual(["openai-session"]);
  });
});
