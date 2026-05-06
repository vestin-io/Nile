import type { MenuItemConstructorOptions } from "electron";

import type { AgentId } from "@nile/core/models/agent";
import { NileLogger } from "@nile/core/services/NileLogger";

import type { MenubarAgentState, MenubarState } from "../../state/Types";

type DesktopTrayMenuOptions = {
  logger: NileLogger;
  peekState(): MenubarState | null;
  refreshState(): Promise<MenubarState>;
  showSettings(): void;
  quitApp(): void;
  switchConnection(agentId: AgentId, connectionId: string): Promise<void>;
};

export class DesktopTrayMenu {
  constructor(private readonly options: DesktopTrayMenuOptions) {}

  async readTemplate(): Promise<MenuItemConstructorOptions[]> {
    const state = await this.options.refreshState().catch((error) => {
      this.options.logger.warn("desktop.menubar_state_refresh_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.options.peekState();
    });
    return this.buildTemplate(state);
  }

  private buildTemplate(state: MenubarState | null): MenuItemConstructorOptions[] {
    if (!state) {
      return [
        { label: "Open Main Window", click: () => this.options.showSettings() },
        { type: "separator" },
        { label: "Loading connections…", enabled: false },
        { type: "separator" },
        { label: "Quit", click: () => this.options.quitApp() },
      ];
    }

    return [
      { label: "Open Main Window", click: () => this.options.showSettings() },
      { type: "separator" },
      ...state.agents.map((agent) => this.buildAgentSubmenu(agent)),
      { type: "separator" },
      { label: "Quit", click: () => this.options.quitApp() },
    ];
  }

  private buildAgentSubmenu(agent: MenubarAgentState): MenuItemConstructorOptions {
    if (agent.connections.length === 0) {
      return {
        label: agent.agentLabel,
        submenu: [{ label: "No saved connections", enabled: false }],
      };
    }

    const submenu: MenuItemConstructorOptions[] = [];
    if (agent.currentUsage?.status === "available") {
      submenu.push({ label: `Quota · ${agent.currentUsage.text}`, enabled: false });
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
        void this.switchConnection(agent.agentId, connection.id);
      },
    })));

    return {
      label: agent.agentLabel,
      submenu,
    };
  }

  private async switchConnection(agentId: AgentId, connectionId: string): Promise<void> {
    try {
      await this.options.switchConnection(agentId, connectionId);
    } catch (error) {
      this.options.logger.warn("desktop.tray.switch_failed", {
        agentId,
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
