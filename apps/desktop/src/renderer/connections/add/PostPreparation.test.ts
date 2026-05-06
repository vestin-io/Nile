import { describe, expect, it } from "vitest";

import { shouldShowStaticCredentialFields } from "./PostPreparation";

describe("shouldShowStaticCredentialFields", () => {
  it("shows static credential fields for api key connections", () => {
    expect(shouldShowStaticCredentialFields("api_key")).toBe(true);
  });

  it("hides static credential fields for auth.json imports", () => {
    expect(shouldShowStaticCredentialFields("openai_session")).toBe(false);
  });

  it("hides static credential fields for claude session connections", () => {
    expect(shouldShowStaticCredentialFields("claude_session")).toBe(false);
  });
});
