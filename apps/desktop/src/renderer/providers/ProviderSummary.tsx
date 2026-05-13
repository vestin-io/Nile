import { ExternalLink } from "lucide-react";

import type { LanguagePreference } from "../settings/Preferences";
import type { Translator } from "../shared/I18n";
import { Field } from "../ui/field";
import { TextButton } from "../ui/text-button";
import { ProviderCatalog } from "./ProviderCatalog";

type ProviderSummaryProps = {
  language: LanguagePreference;
  providerKey: string;
  t: Translator;
};

export function hasProviderSummary(providerKey: string, language: LanguagePreference) {
  return ProviderCatalog.shared.findByKey(providerKey, language) !== null;
}

export function ProviderSummary({ language, providerKey, t }: ProviderSummaryProps) {
  const provider = ProviderCatalog.shared.findByKey(providerKey, language);
  if (!provider) {
    return null;
  }

  return (
    <div className="grid gap-5">
      <Field label={t("providers.aboutSummary")}>
        <div className="text-sm text-muted-foreground">
          <span>{provider.description}</span>
          <TextButton
            className="ml-2 inline-flex items-center gap-1 align-baseline"
            onClick={() => void window.nileDesktop.app.openExternalUrl(provider.officialLink)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("providers.openOfficialSite")}
          </TextButton>
        </div>
      </Field>
    </div>
  );
}
