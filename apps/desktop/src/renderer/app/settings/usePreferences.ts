import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { readDocumentPlatform } from "../../../state/DesktopPlatform";
import { createTranslator, type Translator } from "../../shared/I18n";
import {
  DesktopPreferencesClient,
  type DesktopPreferences,
} from "../../settings/PreferencesClient";
import { ThemeController } from "../../settings/ThemeController";
import {
  readDefaultDesktopPreferences,
  serializeDesktopPreferences,
} from "../../../state/DesktopPreferences";

type DesktopPreferencesState = {
  preferences: DesktopPreferences;
  setPreferences: Dispatch<SetStateAction<DesktopPreferences>>;
  t: Translator;
};

export function useDesktopPreferences(): DesktopPreferencesState {
  const preferencesClient = useMemo(
    () => new DesktopPreferencesClient(),
    [],
  );
  const themeController = useMemo(
    () => new ThemeController(document.documentElement),
    [],
  );
  const [preferences, setPreferences] = useState<DesktopPreferences>(() => readDefaultDesktopPreferences());
  const [isHydrated, setIsHydrated] = useState(false);
  const lastPersistedPreferencesRef = useRef<string>(serializeDesktopPreferences(readDefaultDesktopPreferences()));

  useEffect(() => {
    document.documentElement.dataset.platform = readDocumentPlatform();
    let isMounted = true;
    void preferencesClient.migrateLegacy(window.localStorage).then((nextPreferences) => {
      if (!isMounted) {
        return;
      }
      lastPersistedPreferencesRef.current = serializeDesktopPreferences(nextPreferences);
      setPreferences(nextPreferences);
      setIsHydrated(true);
    });
    return () => {
      isMounted = false;
    };
  }, [preferencesClient]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    const serialized = serializeDesktopPreferences(preferences);
    if (serialized === lastPersistedPreferencesRef.current) {
      themeController.apply(preferences.theme);
      return;
    }
    themeController.apply(preferences.theme);
    lastPersistedPreferencesRef.current = serialized;
    void preferencesClient.save(preferences);
  }, [isHydrated, preferences, preferencesClient, themeController]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => {
      if (preferences.theme === "system") {
        themeController.apply("system");
      }
    };

    syncSystemTheme();
    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, [preferences.theme, themeController]);

  useEffect(() => {
    return preferencesClient.subscribe(() => {
      void preferencesClient.load().then((nextPreferences) => {
        lastPersistedPreferencesRef.current = serializeDesktopPreferences(nextPreferences);
        setPreferences(nextPreferences);
        setIsHydrated(true);
      });
    });
  }, [preferencesClient]);

  useEffect(() => window.nileDesktopEvents.onLocalStateReset(() => {
    setPreferences((current) => ({
      ...current,
      credentialStorageMode: null,
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
