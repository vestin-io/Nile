import { describe, expect, it } from "vitest";

import { createTranslator } from "./I18n";
import { MESSAGE_CATALOG } from "./i18n/catalog";

describe("I18n", () => {
  it("keeps every language catalog aligned with english", () => {
    const englishKeys = Object.keys(MESSAGE_CATALOG.en).sort();

    for (const [language, messages] of Object.entries(MESSAGE_CATALOG)) {
      expect(Object.keys(messages).sort(), language).toEqual(englishKeys);
    }
  });

  it("does not silently fall back to english for unknown keys", () => {
    const t = createTranslator("zh");

    expect(t("missing.translation.key")).toBe("missing.translation.key");
  });
});
