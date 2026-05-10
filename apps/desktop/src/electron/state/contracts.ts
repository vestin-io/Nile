import type { DesktopNotificationHistoryFilterInput } from "../notifications/contracts";

export type DesktopStateBridge = {
  getMenubarState(): Promise<import("../../state/Types").MenubarState>;
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
  getNotificationsMuted(): Promise<boolean>;
  getProfileFeatureEnabled(): Promise<boolean>;
  setNotificationsMuted(muted: boolean): Promise<boolean>;
  setProfileFeatureEnabled(enabled: boolean): Promise<boolean>;
  refreshSettings(): Promise<void>;
  refreshMenubar(): Promise<void>;
};
