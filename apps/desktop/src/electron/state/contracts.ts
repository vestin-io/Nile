import type { LanguagePreference } from "../../state/UiPreferences";
import type { DesktopNotificationHistoryFilterInput } from "../notifications/contracts";
import type { DesktopPreferences } from "../../state/DesktopPreferences";
import type { DesktopStatusEntryDisplayMode, DesktopStatusEntryDisplayState } from "../../state/StatusEntryDisplay";

export type DesktopPreferencesBridge = {
  getDesktopPreferences(): Promise<DesktopPreferences>;
  migrateDesktopPreferences(raw: string | null): Promise<DesktopPreferences>;
  setDesktopPreferences(preferences: DesktopPreferences): Promise<DesktopPreferences>;
  setLanguagePreference(language: LanguagePreference): Promise<LanguagePreference>;
};

export type DesktopStatusEntryBridge = {
  getStatusEntryState(): Promise<import("../../state/Types").DesktopStatusEntryState>;
  getStatusEntryDisplay(): Promise<DesktopStatusEntryDisplayState>;
  setStatusEntryDisplayMode(mode: DesktopStatusEntryDisplayMode): Promise<DesktopStatusEntryDisplayState>;
  toggleStatusEntrySelectedAgent(agentId: import("@nile/core/models/agent").AgentId): Promise<DesktopStatusEntryDisplayState>;
  refreshStatusEntry(): Promise<void>;
};

export type DesktopSettingsDataBridge = {
  getSettingsState(): Promise<import("../../state/Types").SettingsState>;
  getSettingsStateSnapshot(): Promise<import("../../state/Types").SettingsState>;
  getHistoryState(): Promise<import("../../state/Types").HistoryState>;
  refreshSettings(): Promise<import("../../state/Types").SettingsState>;
};

export type DesktopNotificationBridge = {
  getNotificationsMuted(): Promise<boolean>;
  hasUnreadNotifications(): Promise<boolean>;
  getNotificationHistory(
    filter?: DesktopNotificationHistoryFilterInput,
  ): Promise<import("../../state/Types").DesktopNotificationHistoryEntry[]>;
  getNotificationHistoryConnections(
    filter?: DesktopNotificationHistoryFilterInput,
  ): Promise<import("../../state/Types").DesktopNotificationHistoryConnection[]>;
  markNotificationHistoryRead(entryIds: string[]): Promise<void>;
  markNotificationHistoryReadByFilter(filter?: DesktopNotificationHistoryFilterInput): Promise<void>;
  setNotificationsMuted(muted: boolean): Promise<boolean>;
};

export type DesktopProfileFeatureBridge = {
  getProfileFeatureEnabled(): Promise<boolean>;
  setProfileFeatureEnabled(enabled: boolean): Promise<boolean>;
};
