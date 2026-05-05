import type { LanguagePreference } from "../../settings/Preferences";

import { DE_MESSAGES } from "./de";
import { EN_MESSAGES } from "./en";
import { ES_MESSAGES } from "./es";
import { FR_MESSAGES } from "./fr";
import { IT_MESSAGES } from "./it";
import { JA_MESSAGES } from "./ja";
import { KO_MESSAGES } from "./ko";
import { TH_MESSAGES } from "./th";
import type { Messages } from "./types";
import { VI_MESSAGES } from "./vi";
import { ZH_MESSAGES } from "./zh";

export const MESSAGE_CATALOG = buildMessageCatalog({
  en: EN_MESSAGES,
  zh: ZH_MESSAGES,
  ko: KO_MESSAGES,
  ja: JA_MESSAGES,
  th: TH_MESSAGES,
  fr: FR_MESSAGES,
  es: ES_MESSAGES,
  it: IT_MESSAGES,
  de: DE_MESSAGES,
  vi: VI_MESSAGES,
});

function buildMessageCatalog(
  catalog: Record<LanguagePreference, Messages>,
): Record<LanguagePreference, Messages> {
  const englishKeys = Object.keys(catalog.en).sort();

  for (const [language, messages] of Object.entries(catalog) as Array<[LanguagePreference, Messages]>) {
    const missingKeys = englishKeys.filter((key) => !(key in messages));
    const extraKeys = Object.keys(messages).filter((key) => !(key in catalog.en));
    if (missingKeys.length === 0 && extraKeys.length === 0) {
      continue;
    }

    throw new Error(
      [
        `Invalid ${language} translation catalog.`,
        missingKeys.length > 0 ? `Missing keys: ${missingKeys.join(", ")}` : null,
        extraKeys.length > 0 ? `Unexpected keys: ${extraKeys.join(", ")}` : null,
      ].filter(Boolean).join(" "),
    );
  }

  return catalog;
}
