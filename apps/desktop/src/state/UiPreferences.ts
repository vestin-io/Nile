export const SUPPORTED_LANGUAGES = [
  "en",
  "zh",
  "ko",
  "ja",
  "th",
  "fr",
  "es",
  "it",
  "de",
  "vi",
] as const;

export type LanguagePreference = (typeof SUPPORTED_LANGUAGES)[number];
export type ThemePreference = "system" | "light" | "dark";
const supportedLanguageSet = new Set<LanguagePreference>(SUPPORTED_LANGUAGES);

export const LANGUAGE_SELF_LABELS: Record<LanguagePreference, string> = {
  en: "English",
  zh: "中文",
  ko: "한국어",
  ja: "日本語",
  th: "ไทย",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  de: "Deutsch",
  vi: "Tiếng Việt",
};

export function normalizeLanguagePreference(value: unknown): LanguagePreference {
  return typeof value === "string" && supportedLanguageSet.has(value as LanguagePreference)
    ? (value as LanguagePreference)
    : "en";
}

export function parseLanguagePreferenceFromDesktopPreferences(raw: string | null): LanguagePreference | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { language?: unknown };
    return typeof parsed.language === "string" && supportedLanguageSet.has(parsed.language as LanguagePreference)
      ? (parsed.language as LanguagePreference)
      : null;
  } catch {
    return null;
  }
}
