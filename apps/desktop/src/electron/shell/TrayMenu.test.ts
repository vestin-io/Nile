import { describe, expect, it, vi } from "vitest";

import type { AgentId } from "@nile/core/models/agent";
import type { LanguagePreference } from "../../state/UiPreferences";
import type { WorkspaceProfile } from "../profiles/Store";
import { DesktopTrayMenu } from "./TrayMenu";
import type { DesktopConnection, MenubarState, SettingsState } from "../../state/Types";

describe("DesktopTrayMenu", () => {
  it("shows the current profile label between main window and agents", async () => {
    const menu = createMenu({
      profiles: [
        {
          id: "profile-work",
          name: "Work",
          emoji: "🐊",
          assignments: [
            { agentId: "codex", connectionId: "codex-work", homePath: null },
            { agentId: "claude", connectionId: "claude-work", homePath: "/tmp/claude-work" },
          ],
        },
      ],
    });

    const template = await menu.readTemplate();

    expect(template[2]?.label).toBe("🐊 Work");
    expect(readSubmenu(template[2])[0]).toMatchObject({
      checked: true,
      label: "🐊 Work",
      type: "checkbox",
    });
  });

  it("falls back to Profile when no saved profile matches current state", async () => {
    const menu = createMenu({
      profiles: [
        {
          id: "profile-personal",
          name: "Personal",
          assignments: [{ agentId: "codex", connectionId: "codex-personal", homePath: null }],
        },
      ],
    });

    const template = await menu.readTemplate();

    expect(template[2]?.label).toBe("Profile");
    expect(readSubmenu(template[2])[0]).toMatchObject({
      checked: false,
      label: "· Personal",
      type: "checkbox",
    });
  });

  it("applies a selected profile from the submenu", async () => {
    const applyProfile = vi.fn(async () => {});
    const menu = createMenu({
      applyProfile,
      profiles: [
        {
          id: "profile-work",
          name: "Work",
          emoji: "🐊",
          assignments: [
            { agentId: "codex", connectionId: "codex-work", homePath: null },
            { agentId: "claude", connectionId: "claude-work", homePath: "/tmp/claude-work" },
          ],
        },
        {
          id: "profile-personal",
          name: "Personal",
          emoji: "🌊",
          assignments: [
            { agentId: "codex", connectionId: "codex-personal", homePath: null },
            { agentId: "claude", connectionId: "claude-personal", homePath: null },
          ],
        },
      ],
    });

    const template = await menu.readTemplate();
    const submenu = readSubmenu(template[2]);
    submenu[1]?.click?.({} as never, {} as never, {} as never);

    expect(applyProfile).toHaveBeenCalledWith("profile-personal");
  });

  it("shows a profile notification when applying a tray profile fails", async () => {
    const notify = vi.fn();
    const menu = createMenu({
      applyProfile: async () => {
        throw new Error("apply failed");
      },
      notify,
      profiles: [
        {
          id: "profile-personal",
          name: "Personal",
          assignments: [{ agentId: "codex", connectionId: "codex-personal", homePath: null }],
        },
      ],
    });

    const template = await menu.readTemplate();
    const submenu = readSubmenu(template[2]);
    submenu[0]?.click?.({} as never, {} as never, {} as never);
    await Promise.resolve();

    expect(notify).toHaveBeenCalledWith({
      id: "profile-apply-failed:profile-personal",
      title: "Couldn't apply profile",
      body: "Open Profiles to review this work mode.",
      kind: "action-required",
      scope: "profile",
      subject: { id: "profile-personal", label: "Personal" },
      target: { page: "profiles", profileId: "profile-personal" },
      dedupeKey: "profile-apply-failed:profile-personal",
      cooldownMs: 60_000,
    });
  });

  it("keeps submenu profile labels text-aligned by using emoji or a placeholder", async () => {
    const menu = createMenu({
      profiles: [
        {
          id: "profile-work",
          name: "Nilo",
          emoji: "🐊",
          assignments: [{ agentId: "codex", connectionId: "codex-work", homePath: null }],
        },
        {
          id: "profile-plain",
          name: "ooook",
          assignments: [{ agentId: "codex", connectionId: "codex-personal", homePath: null }],
        },
      ],
    });

    const template = await menu.readTemplate();
    const submenu = readSubmenu(template[2]);

    expect(submenu[0]).toMatchObject({ label: "🐊 Nilo" });
    expect(submenu[1]).toMatchObject({ label: "· ooook" });
  });

  it("hides the profile submenu when profile usage is disabled", async () => {
    const menu = createMenu({
      profileFeatureEnabled: false,
      profiles: [
        {
          id: "profile-work",
          name: "Work",
          assignments: [{ agentId: "codex", connectionId: "codex-work", homePath: null }],
        },
      ],
    });

    const template = await menu.readTemplate();

    expect(template.map((item) => item.label)).not.toContain("Profile");
    expect(template.map((item) => item.label)).not.toContain("Work");
  });

  it("falls back to enabled profile menus when feature config read fails", async () => {
    const warn = vi.fn();
    const menu = new DesktopTrayMenu({
      isProfileFeatureEnabled: () => {
        throw new Error("broken config");
      },
      logger: { warn } as never,
      peekState: () => createMenubarState(),
      peekSettingsState: () => createSettingsState(),
      readLanguagePreference: () => "en",
      readConnectionQuotaMetricPreferences: async () => ({}),
      readMenubarDisplay: () => ({ hasConfiguredTickerAgents: false, mode: "app_entry", tickerAgentIds: [] }),
      refreshState: async () => createMenubarState(),
      refreshSettingsState: async () => createSettingsState(),
      listProfiles: () => [{
        id: "profile-work",
        name: "Work",
        assignments: [{ agentId: "codex", connectionId: "codex-work", homePath: null }],
      }],
      notify: () => {},
      showSettings: () => {},
      quitApp: () => {},
      applyProfile: async () => {},
      switchConnection: async () => {},
      toggleTickerAgent: () => {},
    });

    const template = await menu.readTemplate();

    expect(template[2]?.label).toBe("· Work");
    expect(warn).toHaveBeenCalledWith("desktop.tray.profile_feature_read_failed", { error: "broken config" });
  });

  it("shows a connection notification when tray switching fails", async () => {
    const notify = vi.fn();
    const switchConnection = vi.fn(async () => {
      throw new Error("switch failed");
    });
    const menu = createMenu({
      notify,
      profiles: [],
      switchConnection,
    });

    const template = await menu.readTemplate();
    const codexMenu = template.find((item) => item.label === "Codex");
    const submenu = readSubmenu(codexMenu ?? {});
    const personalConnection = submenu.find((item) => item.label === "Codex Personal");
    personalConnection?.click?.({} as never, {} as never, {} as never);
    await Promise.resolve();

    expect(switchConnection).toHaveBeenCalledWith("codex", "codex-personal");
    expect(notify).toHaveBeenCalledWith({
      id: "connection-switch-failed:codex:codex-personal",
      title: "Couldn't switch connection",
      body: "Open Connections to review this saved connection.",
      kind: "action-required",
      scope: "connection",
      subject: { id: "codex-personal", label: "Codex Personal" },
      target: { page: "connections", connectionId: "codex-personal", agentId: "codex" },
      dedupeKey: "connection-switch-failed:codex:codex-personal",
      cooldownMs: 60_000,
    });
  });

  it("shows a ticker toggle under the quota row when usage is available", async () => {
    const toggleTickerAgent = vi.fn();
    const menu = createMenu({
      profiles: [],
      readMenubarDisplay: () => ({ hasConfiguredTickerAgents: true, mode: "ticker", tickerAgentIds: ["codex"] }),
      toggleTickerAgent,
    });

    const template = await menu.readTemplate();
    const codexMenu = template.find((item) => item.label === "Codex");
    const submenu = readSubmenu(codexMenu ?? {});
    const quotaItem = submenu[0];

    expect(quotaItem).toMatchObject({ label: "Quota · 5h 72% left" });
    const quotaSubmenu = readSubmenu(quotaItem ?? {});
    expect(quotaSubmenu[0]).toMatchObject({
      label: "Show in ticker",
      type: "checkbox",
      checked: true,
    });

    quotaSubmenu[0]?.click?.({} as never, {} as never, {} as never);
    expect(toggleTickerAgent).toHaveBeenCalledWith("codex");
  });

  it("localizes tray labels from the stored language preference", async () => {
    const menu = createMenu({
      language: "zh",
      profiles: [],
      readMenubarDisplay: () => ({ hasConfiguredTickerAgents: true, mode: "ticker", tickerAgentIds: ["codex"] }),
    });

    const template = await menu.readTemplate();

    expect(template[0]?.label).toBe("打开主窗口");
    expect(template.at(-1)?.label).toBe("退出");
    const codexMenu = template.find((item) => item.label === "Codex");
    const submenu = readSubmenu(codexMenu ?? {});
    expect(submenu[0]).toMatchObject({ label: "用量 · 5h 72% left" });
    expect(readSubmenu(submenu[0] ?? {})[0]).toMatchObject({ label: "在用量指标中显示" });
  });
});

function createMenu(options: {
  applyProfile?: (profileId: string) => Promise<void>;
  language?: LanguagePreference;
  notify?: (intent: object) => void;
  profileFeatureEnabled?: boolean;
  profiles: WorkspaceProfile[];
  readMenubarDisplay?: () => { hasConfiguredTickerAgents: boolean; mode: "app_entry" | "ticker"; tickerAgentIds: AgentId[] };
  switchConnection?: (agentId: AgentId, connectionId: string) => Promise<void>;
  toggleTickerAgent?: (agentId: AgentId) => void;
}) {
  const settingsState = createSettingsState();
  const menubarState = createMenubarState();

  return new DesktopTrayMenu({
    isProfileFeatureEnabled: () => options.profileFeatureEnabled ?? true,
    logger: {
      warn: () => {},
    } as never,
    peekState: () => menubarState,
    peekSettingsState: () => settingsState,
    readLanguagePreference: () => options.language ?? "en",
    readConnectionQuotaMetricPreferences: async () => ({}),
    readMenubarDisplay: options.readMenubarDisplay ?? (() => ({
      hasConfiguredTickerAgents: false,
      mode: "app_entry",
      tickerAgentIds: [],
    })),
    refreshState: async () => menubarState,
    refreshSettingsState: async () => settingsState,
    listProfiles: () => options.profiles,
    notify: options.notify ?? (() => {}),
    showSettings: () => {},
    quitApp: () => {},
    applyProfile: options.applyProfile ?? (async () => {}),
    switchConnection: options.switchConnection ?? (async () => {}),
    toggleTickerAgent: options.toggleTickerAgent ?? (() => {}),
  });
}

function readSubmenu(item: { submenu?: Electron.Menu | Electron.MenuItemConstructorOptions[] }) {
  if (!Array.isArray(item.submenu)) {
    throw new Error("expected array submenu");
  }
  return item.submenu;
}

function createMenubarState(): MenubarState {
  const codexWork = createConnection("codex-work", "Codex Work", ["codex"]);
  const claudeWork = createConnection("claude-work", "Claude Work", ["claude"]);

  return {
    agents: [
      {
        agentId: "codex",
        agentLabel: "Codex",
        currentConnection: codexWork,
        currentUsage: {
          status: "available",
          windows: [
            { key: "5h", label: "5h", remainingPercent: 72, resetsAt: null },
            { key: "weekly", label: "weekly", remainingPercent: 88, resetsAt: null },
          ],
          windowLabel: "5h",
          remainingPercent: 72,
          text: "5h 72% left",
        },
        connections: [codexWork, createConnection("codex-personal", "Codex Personal", ["codex"])],
      },
      {
        agentId: "cursor",
        agentLabel: "Cursor",
        currentConnection: null,
        currentUsage: {
          status: "available",
          windows: [
            { key: "monthly", label: "monthly", remainingPercent: 6, resetsAt: null },
          ],
          windowLabel: "monthly",
          remainingPercent: 6,
          text: "monthly 6% left",
        },
        connections: [],
      },
      {
        agentId: "claude",
        agentLabel: "Claude",
        currentConnection: claudeWork,
        currentUsage: null,
        connections: [claudeWork, createConnection("claude-personal", "Claude Personal", ["claude"])],
      },
      {
        agentId: "openclaw",
        agentLabel: "OpenClaw",
        currentConnection: null,
        currentUsage: null,
        connections: [],
      },
    ],
  };
}

function createSettingsState(): SettingsState {
  const codexWork = createConnection("codex-work", "Codex Work", ["codex"]);
  const claudeWork = createConnection("claude-work", "Claude Work", ["claude"]);
  const codexPersonal = createConnection("codex-personal", "Codex Personal", ["codex"]);
  const claudePersonal = createConnection("claude-personal", "Claude Personal", ["claude"]);

  return {
    onboarding: null,
    currentConnection: codexWork,
    currentConnectionState: "saved",
    liveConnection: codexWork,
    reconciliationState: "already_saved",
    connections: [codexWork, codexPersonal, claudeWork, claudePersonal],
    currentAgentConnections: [codexWork, claudeWork],
    agents: [
      createAgent("codex", "Codex", codexWork, [codexWork, codexPersonal]),
      createAgent("cursor", "Cursor", null, []),
      createAgent("claude", "Claude", claudeWork, [claudeWork, claudePersonal]),
      createAgent("openclaw", "OpenClaw", null, []),
    ],
    detectedSetups: { mode: "empty", importableCount: 0, items: [] },
    advanced: {
      agentHomes: [
        { agentId: "codex", agentLabel: "Codex", path: "/Users/test/.codex", defaultPath: "/Users/test/.codex" },
        { agentId: "cursor", agentLabel: "Cursor", path: "/Users/test/.cursor", defaultPath: "/Users/test/.cursor" },
        { agentId: "claude", agentLabel: "Claude", path: "/tmp/claude-work", defaultPath: "/Users/test/.claude" },
        { agentId: "openclaw", agentLabel: "OpenClaw", path: "/Users/test/.openclaw", defaultPath: "/Users/test/.openclaw" },
      ],
      supportedAgents: [
        { agentId: "codex", agentLabel: "Codex" },
        { agentId: "cursor", agentLabel: "Cursor" },
        { agentId: "claude", agentLabel: "Claude" },
        { agentId: "openclaw", agentLabel: "OpenClaw" },
      ],
      savedConnectionCount: 4,
      importableSetupCount: 0,
      credentialStorageMode: "system_secure_storage",
      credentialStorageModeMixed: false,
    },
  };
}

function createAgent(
  agentId: AgentId,
  agentLabel: string,
  currentConnection: DesktopConnection | null,
  connections: DesktopConnection[],
): SettingsState["agents"][number] {
  return {
    agentId,
    agentLabel,
    canRollback: false,
    latestRollbackableMutationId: null,
    currentConnection,
    currentUsage: null,
    currentConnectionState: currentConnection ? "saved" : "none",
    liveConnection: currentConnection,
    reconciliationState: currentConnection ? "already_saved" : "unavailable",
    connections,
  };
}

function createConnection(id: string, label: string, enabledAgents: AgentId[]): DesktopConnection {
  return {
    id,
    label,
    endpointLabel: label,
    endpointFamily: "openai",
    authMode: "api_key",
    isCurrent: false,
    activeAlertCount: 0,
    enabledAgents,
    configurableAgents: enabledAgents,
    selectedByAgents: [],
  };
}
