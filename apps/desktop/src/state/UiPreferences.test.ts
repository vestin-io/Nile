import { describe, expect, it } from "vitest";

import { normalizeLanguagePreference, parseLanguagePreferenceFromDesktopPreferences } from "./UiPreferences";

describe("UiPreferences", () => {
  it("normalizes unsupported languages to english", () => {
    expect(normalizeLanguagePreference("zh")).toBe("zh");
    expect(normalizeLanguagePreference("pt")).toBe("en");
  });

  it("reads a stored language preference from desktop preferences json", () => {
    expect(parseLanguagePreferenceFromDesktopPreferences('{"language":"zh"}')).toBe("zh");
    expect(parseLanguagePreferenceFromDesktopPreferences('{"language":"pt"}')).toBeNull();
    expect(parseLanguagePreferenceFromDesktopPreferences("not-json")).toBeNull();
    expect(parseLanguagePreferenceFromDesktopPreferences(null)).toBeNull();
  });
});
