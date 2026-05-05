import {
  SUPPORTED_LANGUAGES,
  type DesktopPreferences,
  type LanguagePreference,
  type ThemePreference,
} from "../Preferences";
import type { Translator } from "../../shared/I18n";
import { Button } from "../../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Separator } from "../../ui/separator";
import type { DesktopReleaseInfo } from "../../../state/Types";
import { SettingsSection } from "./Section";
import { UpdateSection } from "./UpdateSection";

type SettingsPageProps = {
  isResetting: boolean;
  preferences: DesktopPreferences;
  releaseInfo: DesktopReleaseInfo | null;
  onCheckForUpdates(): Promise<void>;
  onInstallUpdate(): Promise<void>;
  onReset(): void;
  onLanguageChange(language: LanguagePreference): void;
  onThemeChange(theme: ThemePreference): void;
  t: Translator;
};

export function SettingsPage({
  isResetting,
  preferences,
  releaseInfo,
  onCheckForUpdates,
  onInstallUpdate,
  onReset,
  onLanguageChange,
  onThemeChange,
  t,
}: SettingsPageProps) {
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <SettingsSection
        title={t("settings.language.title")}
        description={t("settings.language.description")}
      >
        <Select value={preferences.language} onValueChange={(value) => onLanguageChange(value as LanguagePreference)}>
          <SelectTrigger>
            <SelectValue placeholder={t("settings.language.label")} />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.map((language) => (
              <SelectItem key={language} value={language}>
                {t(`settings.language.${language}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsSection>

      <Separator />

      <SettingsSection
        title={t("settings.theme.title")}
        description={t("settings.theme.description")}
      >
        <Select value={preferences.theme} onValueChange={(value) => onThemeChange(value as ThemePreference)}>
          <SelectTrigger>
            <SelectValue placeholder={t("settings.theme.label")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">{t("settings.theme.system")}</SelectItem>
            <SelectItem value="light">{t("settings.theme.light")}</SelectItem>
            <SelectItem value="dark">{t("settings.theme.dark")}</SelectItem>
          </SelectContent>
        </Select>
      </SettingsSection>

      <Separator />

      <UpdateSection
        info={releaseInfo}
        onCheck={onCheckForUpdates}
        onInstall={onInstallUpdate}
        t={t}
      />

      <Separator />

      <SettingsSection
        title={t("settings.reset.title")}
        description={t("settings.reset.description")}
      >
        <Button variant="destructive" onClick={() => void onReset()} disabled={isResetting}>
          {isResetting ? t("settings.reset.inProgress") : t("settings.reset.action")}
        </Button>
      </SettingsSection>
    </div>
  );
}
