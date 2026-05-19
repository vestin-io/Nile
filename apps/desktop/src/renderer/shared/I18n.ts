import type { LanguagePreference, ThemePreference } from "../../state/UiPreferences";

import { MESSAGE_CATALOG } from "./i18n/catalog";

export type Translator = (key: string, variables?: Record<string, string | number>) => string;

export function createTranslator(language: LanguagePreference): Translator {
  const messages = MESSAGE_CATALOG[language];
  return (key, variables) => {
    const template = messages[key] ?? key;
    if (!variables) {
      return template;
    }

    return Object.entries(variables).reduce(
      (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
      template,
    );
  };
}

export function themeLabelKey(theme: ThemePreference): string {
  return `settings.theme.${theme}`;
}
