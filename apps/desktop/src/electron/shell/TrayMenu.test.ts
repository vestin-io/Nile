import { describe, expect, it, vi } from "vitest";

import type { AgentId } from "@nile/core/models/agent";
import { NileLogger } from "@nile/core/services/NileLogger";

import type { LanguagePreference } from "../../state/UiPreferences";
import type { DesktopConnection, DesktopStatusEntryState, SettingsState } from "../../state/Types";
import type { WorkspaceProfile } from "../profiles/Store";
import { DesktopTrayMenu } from "./TrayMenu";

describe("DesktopTrayMenu", () => {
  it("keeps the right-click full menu with profiles and agent submenus", async () => {
    const menu = createMenu({
      profiles: [
        {
          id: "profile-work",
          name: "Work",
          assignments: [{ agentId: "codex", connectionId: "codex-work", homePath: null }],
        },
      ],
    });

    const template = await menu.readTemplate();

    expect(template[0]?.label).toBe("Open Main Window");
    expect(template[2]?.label).toBe("- Work");
    expect(template.some((item) => item.label === "Codex")).toBe(true);
    expect(template.at(-1)?.label).toBe("Quit");
  });

  it("opens the app from the left-click summary action", async () => {
    const showSettings = vi.fn();
    const menu = createMenu({ showSettings });

    const template = await menu.readTemplate();
    template[0]?.click?.({} as never, {} as never, {} as never);

    expect(showSettings).toHaveBeenCalledTimes(1);
  });
});

function createMenu(options: {
  language?: LanguagePreference;
  peekState?: () => DesktopStatusEntryState | null;
  profiles?: WorkspaceProfile[];
  refreshState?: () => Promise<DesktopStatusEntryState>;
  showSettings?: () => void;
  state?: DesktopStatusEntryState;
} = {}) {
  const state = options.state ?? createStatusEntryState();
  const settingsState = createSettingsState();

  return new DesktopTrayMenu({
    isProfileFeatureEnabled: () => true,
    logger: NileLogger.silent(),
    peekState: options.peekState ?? (() => state),
    peekSettingsState: () => settingsState,
    readLanguagePreference: () => options.language ?? "en",
    readStatusEntryDisplay: () => ({
      hasConfiguredSelectedAgents: true,
      mode: "summary",
      selectedAgentIds: ["codex"],
    }),
    readConnectionQuotaMetricPreferences: async () => ({ "codex-work": "weekly" }),
    refreshState: options.refreshState ?? (async () => state),
    refreshSettingsState: async () => settingsState,
    listProfiles: () => options.profiles ?? [],
    showSettings: options.showSettings ?? (() => {}),
    quitApp: () => {},
    applyProfile: async () => {},
    notify: () => {},
    switchConnection: async () => {},
    toggleSelectedAgent: () => {},
  });
}

function createStatusEntryState(): DesktopStatusEntryState {
  const codexConnection = createConnection("codex-work", "Codex Work");
  const claudeConnection = createConnection("claude-work", "Claude Work");

  return {
    agents: [
      {
        agentId: "codex",
        agentLabel: "Codex",
        currentConnection: codexConnection,
        currentUsage: {
          status: "available",
          windows: [
            { key: "5h", label: "5h", remainingPercent: 72, resetsAt: null },
            { key: "weekly", label: "Weekly", remainingPercent: 88, resetsAt: null },
          ],
          windowLabel: "5h",
          remainingPercent: 72,
          text: "5h 72% left",
        },
        connections: [codexConnection, createConnection("codex-personal", "Codex Personal")],
      },
      {
        agentId: "claude",
        agentLabel: "Claude",
        currentConnection: claudeConnection,
        currentUsage: null,
        connections: [claudeConnection],
      },
    ],
  };
}

function createSettingsState(): SettingsState {
  const codexWork = createConnection("codex-work", "Codex Work");

  return {
    onboarding: null,
    currentConnection: codexWork,
    currentConnectionState: "saved",
    liveConnection: codexWork,
    reconciliationState: "already_saved",
    connections: [codexWork],
    currentAgentConnections: [codexWork],
    agents: [
      {
        agentId: "codex",
        agentLabel: "Codex",
        canRollback: false,
        latestRollbackableMutationId: null,
        currentConnection: codexWork,
        currentUsage: null,
        currentConnectionState: "saved",
        liveConnection: codexWork,
        reconciliationState: "already_saved",
        connections: [codexWork],
      },
    ],
    detectedSetups: { mode: "empty", importableCount: 0, items: [] },
    advanced: {
      agentHomes: [
        { agentId: "codex", agentLabel: "Codex", path: "/Users/test/.codex", defaultPath: "/Users/test/.codex" },
      ],
      supportedAgents: [
        { agentId: "codex", agentLabel: "Codex" },
      ],
      savedConnectionCount: 1,
      importableSetupCount: 0,
      credentialStorageMode: "system_secure_storage",
      credentialStorageModeMixed: false,
    },
  };
}

function createConnection(id: string, label: string): DesktopConnection {
  return {
    id,
    label,
    endpointLabel: "OpenAI",
    endpointFamily: "openai",
    authMode: "openai_session",
    isCurrent: id === "codex-work" || id === "claude-work",
    activeAlertCount: 0,
    enabledAgents: [] as AgentId[],
    configurableAgents: [] as AgentId[],
    selectedByAgents: [] as AgentId[],
  };
}
