import { ipcMain } from "electron";

import type { AgentId } from "@nile/core/models/agent";

import {
  STATUS_ENTRY_DISPLAY_MODES,
  type DesktopStatusEntryDisplayMode,
  type DesktopStatusEntryDisplayState,
} from "../../state/StatusEntryDisplay";
import type { DesktopUsageRefreshMode } from "../../state/UsageCache";
import { SUPPORTED_LANGUAGES, type LanguagePreference } from "../../state/UiPreferences";
import { normalizeDesktopPreferences, type DesktopPreferences } from "../../state/DesktopPreferences";
import { DesktopIpcInputValidator } from "./DesktopIpcInputValidator";
import { DesktopStateStore } from "../state/DesktopStateStore";

type DesktopIpcStateRoutesOptions = {
  getDesktopPreferences(): DesktopPreferences;
  getStatusEntryDisplay(): DesktopStatusEntryDisplayState;
  getNotificationsMuted(): boolean;
  getProfileFeatureEnabled(): boolean;
  inputs: DesktopIpcInputValidator;
  notifyLocalStateReset(): void;
  notifyNotificationHistoryChanged(): void;
  notifyPreferencesChanged(): void;
  refreshAll(): void;
  refreshDesktopState(options: {
    invalidate: boolean;
    notifyRenderer: boolean;
    refreshSettingsUsage?: boolean;
    usageRefreshMode?: DesktopUsageRefreshMode;
  }): Promise<void>;
  migrateDesktopPreferences(raw: string | null): DesktopPreferences;
  setDesktopPreferences(preferences: DesktopPreferences): DesktopPreferences;
  setLanguagePreference(language: LanguagePreference): LanguagePreference;
  setStatusEntryDisplayMode(mode: DesktopStatusEntryDisplayMode): DesktopStatusEntryDisplayState;
  setNotificationsMuted(muted: boolean): boolean;
  setProfileFeatureEnabled(enabled: boolean): boolean;
  stateStore: DesktopStateStore;
  toggleStatusEntrySelectedAgent(agentId: AgentId): DesktopStatusEntryDisplayState;
  updateAgentHome(agentId: AgentId, path: string | null): void;
  updateAgentRuntimeCommand(agentId: AgentId, path: string | null): void;
};

export class DesktopIpcStateRoutes {
  constructor(private readonly options: DesktopIpcStateRoutesOptions) {}

  register(): void {
    this.registerReadRoutes();
    this.registerNotificationRoutes();
    this.registerPreferenceRoutes();
    this.registerMutationRoutes();
  }

  private registerReadRoutes(): void {
    const { inputs, stateStore } = this.options;

    ipcMain.handle("desktop:get-status-entry-state", () => stateStore.getStatusEntryState());
    ipcMain.handle("desktop:get-desktop-preferences", () => this.options.getDesktopPreferences());
    ipcMain.handle("desktop:get-status-entry-display", () => this.options.getStatusEntryDisplay());
    ipcMain.handle("desktop:get-settings-state", () => stateStore.getSettingsState());
    ipcMain.handle("desktop:get-settings-state-snapshot", () => stateStore.getSettingsStateSnapshot());
    ipcMain.handle("desktop:get-history-state", () => stateStore.getHistoryState());
    ipcMain.handle("desktop:get-notification-history", (_event, filter: unknown) =>
      stateStore.getNotificationHistory(inputs.readNotificationHistoryFilter(filter)));
    ipcMain.handle("desktop:get-notification-history-connections", (_event, filter: unknown) =>
      stateStore.getNotificationHistoryConnections(inputs.readNotificationHistoryFilter(filter)));
    ipcMain.handle("desktop:has-unread-notifications", () => stateStore.hasUnreadNotifications());
    ipcMain.handle("desktop:get-notifications-muted", () => this.options.getNotificationsMuted());
    ipcMain.handle("desktop:get-profile-feature-enabled", () => this.options.getProfileFeatureEnabled());
  }

  private registerNotificationRoutes(): void {
    const { inputs, stateStore } = this.options;

    ipcMain.handle("desktop:mark-notification-history-read", (_event, entryIds: unknown) => {
      stateStore.markNotificationHistoryRead(inputs.readStringArray(entryIds, "entryIds"));
      this.options.notifyNotificationHistoryChanged();
    });
    ipcMain.handle("desktop:mark-notification-history-read-by-filter", (_event, filter: unknown) => {
      stateStore.markNotificationHistoryReadByFilter(inputs.readNotificationHistoryFilter(filter));
      this.options.notifyNotificationHistoryChanged();
    });
    ipcMain.handle("desktop:set-notifications-muted", (_event, muted: unknown) => {
      return this.options.setNotificationsMuted(inputs.readBoolean(muted, "muted"));
    });
  }

  private registerPreferenceRoutes(): void {
    const { inputs } = this.options;

    ipcMain.handle("desktop:migrate-desktop-preferences", (_event, raw: unknown) => {
      return this.options.migrateDesktopPreferences(inputs.readNullableString(raw, "raw"));
    });
    ipcMain.handle("desktop:set-desktop-preferences", (_event, preferences: unknown) => {
      const next = this.options.setDesktopPreferences(normalizeDesktopPreferences(preferences));
      this.options.notifyPreferencesChanged();
      return next;
    });
    ipcMain.handle("desktop:set-language-preference", (_event, language: unknown) => {
      const next = this.options.setLanguagePreference(this.readLanguagePreference(language));
      this.options.notifyPreferencesChanged();
      return next;
    });
    ipcMain.handle("desktop:set-status-entry-display-mode", (_event, mode: unknown) => {
      return this.options.setStatusEntryDisplayMode(this.readStatusEntryDisplayMode(mode));
    });
    ipcMain.handle("desktop:toggle-status-entry-selected-agent", (_event, agentId: unknown) => {
      return this.options.toggleStatusEntrySelectedAgent(inputs.readAgentId(agentId));
    });
    ipcMain.handle("desktop:set-profile-feature-enabled", (_event, enabled: unknown) => {
      return this.options.setProfileFeatureEnabled(inputs.readBoolean(enabled, "enabled"));
    });
  }

  private registerMutationRoutes(): void {
    const { inputs, stateStore } = this.options;

    ipcMain.handle("desktop:switch-connection", async (_event, agentId: unknown, connectionId: unknown) => {
      const result = await stateStore.switchConnection(
        inputs.readAgentId(agentId),
        inputs.readRequiredString(connectionId, "connectionId"),
      );
      this.options.refreshAll();
      return result;
    });
    ipcMain.handle("desktop:rollback-latest-mutation", async (_event, agentId: unknown) => {
      const result = await stateStore.rollbackLatestMutation(inputs.readAgentId(agentId));
      this.options.refreshAll();
      return result;
    });
    ipcMain.handle("desktop:reset-state", () => {
      const result = stateStore.resetState();
      this.options.notifyLocalStateReset();
      this.options.refreshAll();
      return result;
    });
    ipcMain.handle("desktop:refresh-settings", async () => {
      await this.options.refreshDesktopState({
        invalidate: true,
        notifyRenderer: false,
        refreshSettingsUsage: true,
        usageRefreshMode: "manual",
      });
      return await stateStore.getSettingsState();
    });
    ipcMain.handle("desktop:refresh-status-entry", async () => {
      await this.options.refreshDesktopState({
        invalidate: true,
        notifyRenderer: true,
        usageRefreshMode: "manual",
      });
    });
    ipcMain.handle("desktop:update-agent-home", async (_event, agentId: unknown, path: unknown) => {
      this.options.updateAgentHome(
        inputs.readAgentId(agentId),
        inputs.readNullableString(path, "path"),
      );
      this.options.refreshAll();
    });
    ipcMain.handle("desktop:update-agent-runtime-command", async (_event, agentId: unknown, path: unknown) => {
      this.options.updateAgentRuntimeCommand(
        inputs.readAgentId(agentId),
        inputs.readNullableString(path, "path"),
      );
      this.options.refreshAll();
    });
  }

  private readStatusEntryDisplayMode(value: unknown): DesktopStatusEntryDisplayMode {
    const mode = this.options.inputs.readRequiredString(value, "mode");
    if (STATUS_ENTRY_DISPLAY_MODES.includes(mode as DesktopStatusEntryDisplayMode)) {
      return mode as DesktopStatusEntryDisplayMode;
    }
    throw new Error(`Unsupported status entry display mode: ${mode}`);
  }

  private readLanguagePreference(value: unknown): LanguagePreference {
    const language = this.options.inputs.readRequiredString(value, "language");
    if (SUPPORTED_LANGUAGES.includes(language as LanguagePreference)) {
      return language as LanguagePreference;
    }
    throw new Error(`Unsupported language preference: ${language}`);
  }
}
