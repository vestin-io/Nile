import { describe, expect, it } from "vitest";

import { readProviderLabel } from "./ProviderDisplay";

describe("readProviderLabel", () => {
  it("returns Gemini for gemini endpoint families", () => {
    expect(readProviderLabel("gemini", (key) => key)).toBe("Gemini");
  });
});
