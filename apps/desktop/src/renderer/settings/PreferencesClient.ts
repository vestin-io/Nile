import {
  LANGUAGE_SELF_LABELS,
  SUPPORTED_LANGUAGES,
  type LanguagePreference,
  type ThemePreference,
} from "../../state/UiPreferences";
import type { DesktopPreferences } from "../../state/DesktopPreferences";

const STORAGE_KEY = "nile.desktop.preferences";

export { SUPPORTED_LANGUAGES };
export { LANGUAGE_SELF_LABELS };
export type { DesktopPreferences, LanguagePreference, ThemePreference };

export class DesktopPreferencesClient {
  async load(): Promise<DesktopPreferences> {
    return await window.nileDesktop.preferences.getDesktopPreferences();
  }

  async save(preferences: DesktopPreferences): Promise<DesktopPreferences> {
    return await window.nileDesktop.preferences.setDesktopPreferences(preferences);
  }

  async migrateLegacy(storage: Storage): Promise<DesktopPreferences> {
    const migrated = await window.nileDesktop.preferences.migrateDesktopPreferences(storage.getItem(STORAGE_KEY));
    storage.removeItem(STORAGE_KEY);
    return migrated;
  }

  subscribe(callback: () => void) {
    return window.nileDesktopEvents.onPreferencesChanged(callback);
  }
}
