import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { createTranslator, type Translator } from "../../shared/I18n";
import { DesktopPreferencesStore, type DesktopPreferences } from "../../settings/Preferences";

type DesktopPreferencesState = {
  preferences: DesktopPreferences;
  setPreferences: Dispatch<SetStateAction<DesktopPreferences>>;
  t: Translator;
};

export function useDesktopPreferences(): DesktopPreferencesState {
  const preferencesStore = useMemo(
    () => new DesktopPreferencesStore(window.localStorage, document.documentElement),
    [],
  );
  const [preferences, setPreferences] = useState<DesktopPreferences>(() => preferencesStore.load());

  useEffect(() => {
    document.documentElement.dataset.platform = navigator.userAgent.includes("Mac") ? "mac" : "other";
  }, []);

  useEffect(() => {
    preferencesStore.applyTheme(preferences.theme);
    preferencesStore.save(preferences);
  }, [preferences, preferencesStore]);

  useEffect(() => {
    void window.nileDesktop.state.setLanguagePreference(preferences.language).catch(() => undefined);
  }, [preferences.language]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => {
      if (preferences.theme === "system") {
        preferencesStore.applyTheme("system");
      }
    };

    syncSystemTheme();
    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, [preferences.theme, preferencesStore]);

  useEffect(() => window.nileDesktopEvents.onLocalStateReset(() => {
    setPreferences((current) => ({
      ...current,
      defaultCredentialStorageBackend: null,
      quickSetupDismissed: false,
    }));
  }), []);

  const t = useMemo(() => createTranslator(preferences.language), [preferences.language]);

  return {
    preferences,
    setPreferences,
    t,
  };
}
