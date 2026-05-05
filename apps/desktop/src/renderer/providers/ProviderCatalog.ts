import rawCatalog from "./providers.json";
import {
  SUPPORTED_LANGUAGES,
  type LanguagePreference,
} from "../settings/Preferences";

export type ProviderEntry = {
  provider: string;
  providerKey: string;
  officialLink: string;
  description: string;
};

type ProviderTranslation = {
  provider: string;
  description: string;
};

type ProviderSourceEntry = {
  providerKey: string;
  officialLink: string;
  translations: Map<LanguagePreference, ProviderTranslation>;
};

type ProviderCatalogFile = {
  providers: ProviderSourceEntry[];
};

export class ProviderCatalog {
  static readonly shared = ProviderCatalog.fromUnknown(rawCatalog);

  private constructor(private readonly providers: ProviderSourceEntry[]) {}

  static fromUnknown(input: unknown): ProviderCatalog {
    return new ProviderCatalog(this.readCatalogFile(input).providers);
  }

  list(language: LanguagePreference): readonly ProviderEntry[] {
    return this.providers
      .map((provider) => this.localizeProvider(provider, language))
      .sort((left, right) => left.provider.localeCompare(right.provider));
  }

  findByKey(providerKey: string, language: LanguagePreference): ProviderEntry | null {
    const provider = this.providers.find((entry) => entry.providerKey === providerKey);
    if (!provider) {
      return null;
    }

    return this.localizeProvider(provider, language);
  }

  private static readCatalogFile(input: unknown): ProviderCatalogFile {
    const value = this.readRecord(input, "provider catalog");
    const providers = value.providers;
    if (!Array.isArray(providers)) {
      throw new Error("Provider catalog must contain a providers array.");
    }

    return {
      providers: providers.map((entry, index) => this.readProviderEntry(entry, index)),
    };
  }

  private static readProviderEntry(input: unknown, index: number): ProviderSourceEntry {
    const value = this.readRecord(input, `provider entry ${index}`);
    return {
      providerKey: this.readString(value.providerKey, `providers[${index}].providerKey`),
      officialLink: this.readUrl(value.officialLink, `providers[${index}].officialLink`),
      translations: this.readTranslations(value.translations, index),
    };
  }

  private static readTranslations(input: unknown, index: number): Map<LanguagePreference, ProviderTranslation> {
    const value = this.readRecord(input, `providers[${index}].translations`);
    const translations = new Map<LanguagePreference, ProviderTranslation>();

    for (const [languageKey, rawTranslation] of Object.entries(value)) {
      const language = this.readLanguage(languageKey, `providers[${index}].translations`);
      const translation = this.readRecord(rawTranslation, `providers[${index}].translations.${language}`);
      translations.set(language, {
        provider: this.readString(translation.provider, `providers[${index}].translations.${language}.provider`),
        description: this.readString(translation.description, `providers[${index}].translations.${language}.description`),
      });
    }

    if (!translations.has("en")) {
      throw new Error(`providers[${index}].translations must include an en translation.`);
    }

    return translations;
  }

  private static readRecord(input: unknown, label: string): Record<string, unknown> {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error(`Invalid ${label}.`);
    }

    return input as Record<string, unknown>;
  }

  private static readString(input: unknown, label: string): string {
    if (typeof input !== "string" || input.trim().length === 0) {
      throw new Error(`${label} must be a non-empty string.`);
    }

    return input.trim();
  }

  private static readUrl(input: unknown, label: string): string {
    const value = this.readString(input, label);
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") {
      throw new Error(`${label} must use https.`);
    }

    return parsed.toString();
  }

  private static readLanguage(input: string, label: string): LanguagePreference {
    if (SUPPORTED_LANGUAGES.includes(input as LanguagePreference)) {
      return input as LanguagePreference;
    }

    throw new Error(`${label} contains unsupported language ${input}.`);
  }

  private localizeProvider(source: ProviderSourceEntry, language: LanguagePreference): ProviderEntry {
    const translation = source.translations.get(language) ?? source.translations.get("en");
    if (!translation) {
      throw new Error(`Provider ${source.providerKey} is missing required en translation.`);
    }

    return {
      provider: translation.provider,
      providerKey: source.providerKey,
      officialLink: source.officialLink,
      description: translation.description,
    };
  }
}
