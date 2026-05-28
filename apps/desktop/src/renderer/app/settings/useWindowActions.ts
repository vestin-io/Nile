import type { AgentId } from "@nile/core/models/agent";

import type { WorkspaceProfileAssignment } from "../../profiles/useProfiles";
import type { SettingsPageContentProps } from "./PageContentProps";

type SettingsWindowActionsOptions = {
  exportCredentials(selectedConnectionIds?: string[]): Promise<void>;
  importCredentials(): Promise<void>;
  refresh(): Promise<void>;
  reload(): Promise<void>;
  refreshProfiles(): Promise<void>;
  setNotificationsMuted(muted: boolean): Promise<void>;
  setPreferences(
    updater: (current: SettingsPageContentProps["preferences"]) => SettingsPageContentProps["preferences"],
  ): void;
  setProfileFeatureEnabled(enabled: boolean): Promise<void>;
  setStatusEntryDisplayMode(mode: SettingsPageContentProps["statusEntryDisplayMode"]): Promise<void>;
  settingsState: SettingsPageContentProps["settingsState"];
};

export type SettingsWindowActions = {
  checkForUpdates(): Promise<void>;
  createConnectionAlert: SettingsPageContentProps["onCreateConnectionAlert"];
  deleteConnectionAlert: SettingsPageContentProps["onDeleteConnectionAlert"];
  exportCredentials(selectedConnectionIds?: string[]): Promise<void>;
  importCredentials(): Promise<void>;
  languageChange(language: SettingsPageContentProps["language"]): void;
  openProvidersLink(url: string): Promise<void>;
  profileApply(profileId: string): Promise<void>;
  profileCreate(name: string, emoji: string, assignments: WorkspaceProfileAssignment[]): Promise<string>;
  profileDelete(profileId: string): Promise<void>;
  profileFeatureEnabledChange(enabled: boolean): Promise<void>;
  profileSave(profileId: string, name: string, emoji: string, assignments: WorkspaceProfileAssignment[]): Promise<void>;
  saveAgentHome(agentId: AgentId, path: string | null): Promise<void>;
  saveAgentRuntimeCommand(agentId: AgentId, path: string | null): Promise<void>;
  setNotificationsMuted(muted: boolean): Promise<void>;
  setStatusEntryDisplayMode(mode: SettingsPageContentProps["statusEntryDisplayMode"]): Promise<void>;
  themeChange(theme: SettingsPageContentProps["preferences"]["theme"]): void;
  updateAgentConnectionModel(agentId: AgentId, connectionId: string, modelId: string | null): Promise<void>;
  updateConnectionAlert: SettingsPageContentProps["onUpdateConnectionAlert"];
};

export function useSettingsWindowActions(options: SettingsWindowActionsOptions): SettingsWindowActions {
  return {
    checkForUpdates: async () => {
      await window.nileDesktop.updates.checkForUpdates().catch(() => ({ status: "unavailable" as const }));
    },
    createConnectionAlert: async (input) => {
      await window.nileDesktop.connections.createUsageAlert(input);
      await options.reload();
    },
    deleteConnectionAlert: async (connectionId, alertId) => {
      await window.nileDesktop.connections.deleteUsageAlert(connectionId, alertId);
      await options.reload();
    },
    exportCredentials: options.exportCredentials,
    importCredentials: options.importCredentials,
    languageChange: (language) => options.setPreferences((current) => ({ ...current, language })),
    openProvidersLink: async (url) => {
      await window.nileDesktop.app.openExternalUrl(url);
    },
    profileApply: async (profileId) => {
      await window.nileDesktop.profiles.applyProfile(profileId);
    },
    profileCreate: async (name, emoji, assignments) => {
      const profile = await window.nileDesktop.profiles.createProfile(name, emoji, assignments);
      await options.refreshProfiles();
      return profile.id;
    },
    profileDelete: async (profileId) => {
      await window.nileDesktop.profiles.deleteProfile(profileId);
    },
    profileFeatureEnabledChange: options.setProfileFeatureEnabled,
    profileSave: async (profileId, name, emoji, assignments) => {
      await window.nileDesktop.profiles.updateProfile(profileId, name, emoji, assignments);
    },
    saveAgentHome: async (agentId, path) => {
      await window.nileDesktop.app.updateAgentHome(agentId, path);
    },
    saveAgentRuntimeCommand: async (agentId, path) => {
      await window.nileDesktop.app.updateAgentRuntimeCommand(agentId, path);
    },
    setNotificationsMuted: options.setNotificationsMuted,
    setStatusEntryDisplayMode: options.setStatusEntryDisplayMode,
    themeChange: (theme) => options.setPreferences((current) => ({ ...current, theme })),
    updateAgentConnectionModel: async (agentId, connectionId, modelId) => {
      const agent = options.settingsState.agents.find((entry) => entry.agentId === agentId) ?? null;
      await window.nileDesktop.connections.updateAgentConnectionModel({
        agentId,
        connectionId,
        modelId,
        applyIfCurrent: agent?.currentConnection?.id === connectionId,
      });
    },
    updateConnectionAlert: async (input) => {
      await window.nileDesktop.connections.updateUsageAlert(input);
      await options.reload();
    },
  };
}
