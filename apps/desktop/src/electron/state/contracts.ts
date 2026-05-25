import type { LanguagePreference } from "../../state/UiPreferences";
import type { DesktopNotificationHistoryFilterInput } from "../notifications/contracts";
import type { DesktopStatusEntryDisplayMode, DesktopStatusEntryDisplayState } from "./StatusEntryDisplayStore";

export type DesktopStateBridge = {
  getStatusEntryState(): Promise<import("../../state/Types").DesktopStatusEntryState>;
  getStatusEntryDisplay(): Promise<DesktopStatusEntryDisplayState>;
  getSettingsState(): Promise<import("../../state/Types").SettingsState>;
  getSettingsStateSnapshot(): Promise<import("../../state/Types").SettingsState>;
  getHistoryState(): Promise<import("../../state/Types").HistoryState>;
  getNotificationHistory(
    filter?: DesktopNotificationHistoryFilterInput,
  ): Promise<import("../../state/Types").DesktopNotificationHistoryEntry[]>;
  getNotificationHistoryConnections(
    filter?: DesktopNotificationHistoryFilterInput,
  ): Promise<import("../../state/Types").DesktopNotificationHistoryConnection[]>;
  hasUnreadNotifications(): Promise<boolean>;
  markNotificationHistoryRead(entryIds: string[]): Promise<void>;
  markNotificationHistoryReadByFilter(filter?: DesktopNotificationHistoryFilterInput): Promise<void>;
  setLanguagePreference(language: LanguagePreference): Promise<LanguagePreference>;
  setStatusEntryDisplayMode(mode: DesktopStatusEntryDisplayMode): Promise<DesktopStatusEntryDisplayState>;
  getNotificationsMuted(): Promise<boolean>;
  getProfileFeatureEnabled(): Promise<boolean>;
  setNotificationsMuted(muted: boolean): Promise<boolean>;
  toggleStatusEntrySelectedAgent(agentId: import("@nile/core/models/agent").AgentId): Promise<DesktopStatusEntryDisplayState>;
  setProfileFeatureEnabled(enabled: boolean): Promise<boolean>;
  refreshSettings(): Promise<void>;
  refreshStatusEntry(): Promise<void>;
};
