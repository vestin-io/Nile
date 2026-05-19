import type { MenuItemConstructorOptions } from "electron";

import type { AgentId } from "@nile/core/models/agent";
import { NileLogger } from "@nile/core/services/NileLogger";

import { createTranslator, type Translator } from "../../renderer/shared/I18n";
import type { LanguagePreference } from "../../state/UiPreferences";
import { readCurrentProfile } from "../../profiles/CurrentProfile";
import type { MenubarAgentState, MenubarState, SettingsState } from "../../state/Types";
import type { DesktopNotificationIntent } from "../notifications/Types";
import type { WorkspaceProfile } from "../profiles/Store";
import type { DesktopMenubarDisplayState } from "../state/MenubarDisplayStore";
import { DesktopTrayTickerTitle } from "./TickerTitle";

type DesktopTrayMenuOptions = {
  isProfileFeatureEnabled(): boolean;
  logger: NileLogger;
  peekState(): MenubarState | null;
  peekSettingsState(): SettingsState | null;
  readLanguagePreference(): LanguagePreference;
  readMenubarDisplay(): DesktopMenubarDisplayState;
  refreshState(): Promise<MenubarState>;
  refreshSettingsState(): Promise<SettingsState>;
  listProfiles(): WorkspaceProfile[];
  showSettings(): void;
  quitApp(): void;
  applyProfile(profileId: string): Promise<void>;
  notify(intent: DesktopNotificationIntent): void;
  switchConnection(agentId: AgentId, connectionId: string): Promise<void>;
  toggleTickerAgent(agentId: AgentId): void;
};

export class DesktopTrayMenu {
  private static readonly PROFILE_EMOJI_PLACEHOLDER = "·";

  constructor(private readonly options: DesktopTrayMenuOptions) {}

  async readTemplate(): Promise<MenuItemConstructorOptions[]> {
    const state = await this.options.refreshState().catch((error) => {
      this.options.logger.warn("desktop.menubar_state_refresh_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.options.peekState();
    });
    const settingsState = await this.options.refreshSettingsState().catch((error) => {
      this.options.logger.warn("desktop.settings_state_refresh_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.options.peekSettingsState();
    });
    return this.buildTemplate(state, settingsState, this.options.listProfiles(), this.readTranslator());
  }

  private buildTemplate(
    state: MenubarState | null,
    settingsState: SettingsState | null,
    profiles: WorkspaceProfile[],
    t: Translator,
  ): MenuItemConstructorOptions[] {
    const menubarDisplay = this.options.readMenubarDisplay();
    const selectedTickerAgentIds = new Set(DesktopTrayTickerTitle.readSelectedAgentIds(state, menubarDisplay));
    const profileMenu = this.readProfileFeatureEnabled()
      ? this.buildProfileSubmenu(
          profiles,
          settingsState ? readCurrentProfile(profiles, settingsState.agents, settingsState.advanced.agentHomes) : null,
          t,
        )
      : null;

    if (!state) {
      return [
        { label: t("tray.openMainWindow"), click: () => this.options.showSettings() },
        { type: "separator" },
        ...(profileMenu ? [profileMenu, { type: "separator" as const }] : []),
        { label: t("tray.loadingConnections"), enabled: false },
        { type: "separator" },
        { label: t("tray.quit"), click: () => this.options.quitApp() },
      ];
    }

    return [
        { label: t("tray.openMainWindow"), click: () => this.options.showSettings() },
        { type: "separator" },
        ...(profileMenu ? [profileMenu, { type: "separator" as const }] : []),
        ...state.agents.map((agent) => this.buildAgentSubmenu(agent, selectedTickerAgentIds, t)),
        { type: "separator" },
        { label: t("tray.quit"), click: () => this.options.quitApp() },
      ];
  }

  private buildProfileSubmenu(
    profiles: WorkspaceProfile[],
    currentProfile: WorkspaceProfile | null,
    t: Translator,
  ): MenuItemConstructorOptions {
    if (profiles.length === 0) {
      return {
        label: t("tray.profile"),
        submenu: [{ label: t("tray.noSavedProfiles"), enabled: false }],
      };
    }

    return {
      label: currentProfile ? this.formatProfileLabel(currentProfile) : t("tray.profile"),
      submenu: profiles.map<MenuItemConstructorOptions>((profile) => ({
        label: this.formatProfileLabel(profile),
        type: "checkbox",
        checked: profile.id === currentProfile?.id,
        click: () => {
          if (profile.id === currentProfile?.id) {
            return;
          }
          void this.applyProfile(profile.id, profile.name);
        },
      })),
    };
  }

  private buildAgentSubmenu(
    agent: MenubarAgentState,
    selectedTickerAgentIds: Set<AgentId>,
    t: Translator,
  ): MenuItemConstructorOptions {
    if (agent.connections.length === 0) {
      return {
        label: agent.agentLabel,
        submenu: [{ label: t("tray.noSavedConnections"), enabled: false }],
      };
    }

    const submenu: MenuItemConstructorOptions[] = [];
    if (agent.currentUsage?.status === "available") {
      submenu.push({
        label: t("tray.quota", { text: agent.currentUsage.text }),
        submenu: [{
          label: t("tray.showInTicker"),
          type: "checkbox",
          checked: selectedTickerAgentIds.has(agent.agentId),
          click: () => {
            this.options.toggleTickerAgent(agent.agentId);
          },
        }],
      });
      submenu.push({ type: "separator" });
    }

    submenu.push(...agent.connections.map<MenuItemConstructorOptions>((connection) => ({
      label: connection.label,
      type: "checkbox",
      checked: connection.isCurrent,
      click: () => {
        if (connection.isCurrent) {
          return;
        }
        void this.switchConnection(agent.agentId, connection.id, connection.label);
      },
    })));

    return {
      label: agent.agentLabel,
      submenu,
    };
  }

  private async switchConnection(agentId: AgentId, connectionId: string, connectionLabel: string): Promise<void> {
    try {
      await this.options.switchConnection(agentId, connectionId);
    } catch (error) {
      this.options.logger.warn("desktop.tray.switch_failed", {
        agentId,
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      const t = this.readTranslator();
      this.options.notify({
        id: `connection-switch-failed:${agentId}:${connectionId}`,
        title: t("tray.connectionSwitchFailedTitle"),
        body: t("tray.connectionSwitchFailedBody"),
        kind: "action-required",
        scope: "connection",
        subject: {
          id: connectionId,
          label: connectionLabel,
        },
        target: { page: "connections", connectionId, agentId },
        dedupeKey: `connection-switch-failed:${agentId}:${connectionId}`,
        cooldownMs: 60_000,
      });
    }
  }

  private async applyProfile(profileId: string, profileName: string): Promise<void> {
    try {
      await this.options.applyProfile(profileId);
    } catch (error) {
      this.options.logger.warn("desktop.tray.apply_profile_failed", {
        profileId,
        error: error instanceof Error ? error.message : String(error),
      });
      const t = this.readTranslator();
      this.options.notify({
        id: `profile-apply-failed:${profileId}`,
        title: t("tray.profileApplyFailedTitle"),
        body: t("tray.profileApplyFailedBody"),
        kind: "action-required",
        scope: "profile",
        subject: {
          id: profileId,
          label: profileName,
        },
        target: { page: "profiles", profileId },
        dedupeKey: `profile-apply-failed:${profileId}`,
        cooldownMs: 60_000,
      });
    }
  }

  private readProfileFeatureEnabled(): boolean {
    try {
      return this.options.isProfileFeatureEnabled();
    } catch (error) {
      this.options.logger.warn("desktop.tray.profile_feature_read_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return true;
    }
  }

  private formatProfileLabel(profile: WorkspaceProfile): string {
    const emoji = profile.emoji?.trim() || DesktopTrayMenu.PROFILE_EMOJI_PLACEHOLDER;
    return `${emoji} ${profile.name}`;
  }

  private readTranslator(): Translator {
    return createTranslator(this.options.readLanguagePreference());
  }
}
