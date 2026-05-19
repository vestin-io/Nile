import type { LanguagePreference } from "../../state/UiPreferences";
import type { DesktopNotificationHistoryFilterInput } from "../notifications/contracts";
import type { DesktopMenubarDisplayMode, DesktopMenubarDisplayState } from "./MenubarDisplayStore";

export type DesktopStateBridge = {
  getMenubarState(): Promise<import("../../state/Types").MenubarState>;
  getMenubarDisplay(): Promise<DesktopMenubarDisplayState>;
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
  setMenubarDisplayMode(mode: DesktopMenubarDisplayMode): Promise<DesktopMenubarDisplayState>;
  getNotificationsMuted(): Promise<boolean>;
  getProfileFeatureEnabled(): Promise<boolean>;
  setNotificationsMuted(muted: boolean): Promise<boolean>;
  toggleMenubarTickerAgent(agentId: import("@nile/core/models/agent").AgentId): Promise<DesktopMenubarDisplayState>;
  setProfileFeatureEnabled(enabled: boolean): Promise<boolean>;
  refreshSettings(): Promise<void>;
  refreshMenubar(): Promise<void>;
};
