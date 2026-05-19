import {
  LANGUAGE_SELF_LABELS,
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
  isLoadedNotificationMute: boolean;
  isLoadedMenubarDisplay: boolean;
  isSavingMenubarDisplay: boolean;
  isSavingNotificationMute: boolean;
  isResetting: boolean;
  isSavingProfileFeature: boolean;
  menubarDisplayMode: Awaited<ReturnType<typeof window.nileDesktop.state.getMenubarDisplay>>["mode"];
  notificationsMuted: boolean;
  preferences: DesktopPreferences;
  profileFeatureEnabled: boolean;
  releaseInfo: DesktopReleaseInfo | null;
  onCheckForUpdates(): Promise<void>;
  onInstallUpdate(): Promise<void>;
  onMenubarDisplayModeChange(
    mode: Awaited<ReturnType<typeof window.nileDesktop.state.getMenubarDisplay>>["mode"],
  ): Promise<void>;
  onNotificationsMutedChange(muted: boolean): Promise<void>;
  onProfileFeatureEnabledChange(enabled: boolean): Promise<void>;
  onReset(): void;
  onLanguageChange(language: LanguagePreference): void;
  onThemeChange(theme: ThemePreference): void;
  t: Translator;
};

export function SettingsPage({
  isLoadedNotificationMute,
  isLoadedMenubarDisplay,
  isSavingMenubarDisplay,
  isSavingNotificationMute,
  isResetting,
  isSavingProfileFeature,
  menubarDisplayMode,
  notificationsMuted,
  preferences,
  profileFeatureEnabled,
  releaseInfo,
  onCheckForUpdates,
  onInstallUpdate,
  onMenubarDisplayModeChange,
  onNotificationsMutedChange,
  onProfileFeatureEnabledChange,
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
                {LANGUAGE_SELF_LABELS[language]}
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

      <SettingsSection
        title={t("settings.notifications.title")}
        description={t("settings.notifications.description")}
      >
        <Select
          value={notificationsMuted ? "on" : "off"}
          onValueChange={(value) => {
            void onNotificationsMutedChange(value === "on");
          }}
          disabled={!isLoadedNotificationMute || isSavingNotificationMute}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("settings.notifications.muteLabel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="on">{t("common.on")}</SelectItem>
            <SelectItem value="off">{t("common.off")}</SelectItem>
          </SelectContent>
        </Select>
      </SettingsSection>

      <Separator />

      <SettingsSection
        title={t("settings.menubar.title")}
        description={t("settings.menubar.description")}
      >
        <Select
          value={menubarDisplayMode}
          onValueChange={(value) => {
            void onMenubarDisplayModeChange(
              value as Awaited<ReturnType<typeof window.nileDesktop.state.getMenubarDisplay>>["mode"],
            );
          }}
          disabled={!isLoadedMenubarDisplay || isSavingMenubarDisplay}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("settings.menubar.label")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="app_entry">{t("settings.menubar.appEntry")}</SelectItem>
            <SelectItem value="ticker">{t("settings.menubar.ticker")}</SelectItem>
          </SelectContent>
        </Select>
      </SettingsSection>

      <Separator />

      <SettingsSection
        title={t("settings.profiles.title")}
        description={t("settings.profiles.description")}
      >
        <Select
          value={profileFeatureEnabled ? "enabled" : "disabled"}
          onValueChange={(value) => {
            void onProfileFeatureEnabledChange(value === "enabled");
          }}
          disabled={isSavingProfileFeature}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("settings.profiles.label")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="enabled">{t("settings.profiles.enabled")}</SelectItem>
            <SelectItem value="disabled">{t("settings.profiles.disabled")}</SelectItem>
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
