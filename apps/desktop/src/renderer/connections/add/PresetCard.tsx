import { Waypoints } from "lucide-react";
import openAiSvg from "../../../../node_modules/@lobehub/icons-static-svg/icons/openai.svg";
import azureAiSvg from "../../../../node_modules/@lobehub/icons-static-svg/icons/azureai-color.svg";
import claudeSvg from "../../../../node_modules/@lobehub/icons-static-svg/icons/claude.svg";

import type { Translator } from "../../shared/I18n";
import { readDefinitionKeywords, type Definition } from "../../shared/Definitions";
import { authModeLabel } from "../../shared/DisplayText";
import type { LanguagePreference } from "../../settings/Preferences";
import { ProviderSummary } from "../../providers/ProviderSummary";
import { Card } from "../../ui/card";
import { type ComboboxItem, Combobox } from "../../ui/combobox";
import { Separator } from "../../ui/separator";

type AddConnectionPresetCardProps = {
  definitions: Definition[];
  isSessionStructureLocked: boolean;
  language: LanguagePreference;
  selectedDefinition: Definition | null;
  selectedPreset: string;
  t: Translator;
  onPresetChange(value: Definition["preset"]): void;
};

export function AddConnectionPresetCard({
  definitions,
  isSessionStructureLocked,
  language,
  selectedDefinition,
  selectedPreset,
  t,
  onPresetChange,
}: AddConnectionPresetCardProps) {
  const presetItems = definitions.map((definition) => ({
    value: definition.preset,
    label: definition.label,
    description: definition.supportedAuthModes.map((mode) => authModeLabel(mode, t)).join(" · "),
    icon: readPresetIcon(definition.preset),
    keywords: readDefinitionKeywords(definition),
  })) satisfies ComboboxItem<Definition["preset"]>[];

  return (
    <Card className="rounded-2xl">
      <div className="grid gap-6 p-6">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">{t("addConnection.choosePreset")}</h2>
            <p className="text-sm text-muted-foreground">{t("addConnection.choosePresetDescription")}</p>
          </div>
          <div className="grid gap-2">
            <Combobox
              disabled={isSessionStructureLocked}
              items={presetItems}
              value={selectedPreset}
              placeholder={t("addConnection.presetPlaceholder")}
              searchPlaceholder={t("addConnection.searchPresetPlaceholder")}
              emptyLabel={t("addConnection.noPresetResults")}
              onValueChange={onPresetChange}
            />
          </div>
        </section>

        {selectedDefinition ? (
          <>
            <Separator />
            <ProviderSummary
              language={language}
              providerKey={selectedDefinition.preset}
              t={t}
            />
          </>
        ) : null}
      </div>
    </Card>
  );
}

function readPresetIcon(preset: Definition["preset"]) {
  if (preset === "openai") {
    return <BrandIcon svg={openAiSvg} />;
  }
  if (preset === "gateway") {
    return <Waypoints className="h-4 w-4" />;
  }
  if (preset === "azure-openai") {
    return <BrandIcon svg={azureAiSvg} />;
  }
  return <BrandIcon svg={claudeSvg} />;
}

function BrandIcon({ svg }: { svg: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-4 shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
