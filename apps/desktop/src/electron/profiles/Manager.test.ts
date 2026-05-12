import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { AgentId } from "@nile/core/models/agent";

import type { DesktopConnection, SettingsState } from "../../state/Types";
import type { DesktopStateStore } from "../state/DesktopStateStore";
import { WorkspaceProfileManager } from "./Manager";
import { WorkspaceProfileStore } from "./Store";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("WorkspaceProfileManager", () => {
  it("creates a profile from explicit renderer-provided assignments", () => {
    const setup = createManager(createSettingsState());

    const profile = setup.manager.create("Work", "💼", [
      { agentId: "codex", connectionId: "codex-work", homePath: null },
      { agentId: "claude", connectionId: "claude-work", homePath: "/tmp/claude-work" },
    ]);

    expect(profile.emoji).toBe("💼");
    expect(profile.assignments).toEqual([
      { agentId: "codex", connectionId: "codex-work", homePath: null },
      { agentId: "claude", connectionId: "claude-work", homePath: "/tmp/claude-work" },
    ]);
  });

  it("applies home paths before switching connections", async () => {
    const setup = createManager(createOutdatedSettingsState());
    const profile = setup.store.create({
      name: "Work",
      assignments: [
        { agentId: "codex", connectionId: "codex-work", homePath: null },
        { agentId: "claude", connectionId: "claude-work", homePath: "/tmp/claude-work" },
      ],
    });

    await setup.manager.apply(profile.id);

    expect(setup.events).toEqual([
      "home:codex:default",
      "home:claude:/tmp/claude-work",
      "switch:codex:codex-work",
      "switch:claude:claude-work",
    ]);
  });

  it("skips profile assignments that already match the current state", async () => {
    const setup = createManager(createSettingsState());
    const profile = setup.store.create({
      name: "Current",
      assignments: [
        { agentId: "codex", connectionId: "codex-work", homePath: null },
        { agentId: "claude", connectionId: "claude-work", homePath: "/tmp/claude-work" },
      ],
    });

    await setup.manager.apply(profile.id);

    expect(setup.events).toEqual([]);
  });

  it("rejects deleted or incompatible profile connections before applying anything", async () => {
    const setup = createManager(createSettingsState());
    const profile = setup.store.create({
      name: "Broken",
      assignments: [{ agentId: "codex", connectionId: "missing" }],
    });

    await expect(setup.manager.apply(profile.id)).rejects.toThrow("references a connection");
    expect(setup.events).toEqual([]);
  });

  it("updates stored profile metadata and assignments together", () => {
    const setup = createManager(createSettingsState());
    const profile = setup.store.create({
      name: "Work",
      assignments: [{ agentId: "codex", connectionId: "codex-work" }],
    });

    const updated = setup.manager.update(profile.id, "Company", "🚀", [
      { agentId: "codex", connectionId: "codex-work", homePath: null },
      { agentId: "claude", connectionId: "claude-work", homePath: "/tmp/claude-work" },
    ]);

    expect(updated.name).toBe("Company");
    expect(updated.emoji).toBe("🚀");
    expect(updated.assignments).toEqual([
      { agentId: "codex", connectionId: "codex-work", homePath: null },
      { agentId: "claude", connectionId: "claude-work", homePath: "/tmp/claude-work" },
    ]);
    expect(setup.store.read(profile.id)).toEqual(updated);
  });
});

function createManager(state: SettingsState) {
  const events: string[] = [];
  const store = new WorkspaceProfileStore(createStorePath());
  const stateStore = {
    async getSettingsState() {
      return state;
    },
    async switchConnection(agentId: AgentId, connectionId: string) {
      events.push(`switch:${agentId}:${connectionId}`);
      return readConnection(state, agentId, connectionId);
    },
  } as DesktopStateStore;
  const manager = new WorkspaceProfileManager({
    stateStore,
    store,
    updateAgentHome(agentId, path) {
      events.push(`home:${agentId}:${path ?? "default"}`);
    },
  });

  return { events, manager, store };
}

function createSettingsState(): SettingsState {
  const codexWork = createConnection("codex-work", "Codex Work", ["codex"]);
  const claudeWork = createConnection("claude-work", "Claude Work", ["claude"]);
  return {
    onboarding: null,
    currentConnection: codexWork,
    currentConnectionState: "saved",
    liveConnection: codexWork,
    reconciliationState: "already_saved",
    connections: [codexWork, claudeWork],
    currentAgentConnections: [codexWork],
    agents: [
      createAgent("codex", "Codex", codexWork, [codexWork]),
      createAgent("claude", "Claude", claudeWork, [claudeWork]),
      createAgent("cursor", "Cursor", null, []),
      createAgent("openclaw", "OpenClaw", null, []),
    ],
    detectedSetups: { mode: "empty", importableCount: 0, items: [] },
    advanced: {
      agentHomes: [
        { agentId: "codex", agentLabel: "Codex", path: "/Users/test/.codex", defaultPath: "/Users/test/.codex" },
        { agentId: "claude", agentLabel: "Claude", path: "/tmp/claude-work", defaultPath: "/Users/test/.claude" },
        { agentId: "cursor", agentLabel: "Cursor", path: "/Users/test/.cursor", defaultPath: "/Users/test/.cursor" },
        { agentId: "openclaw", agentLabel: "OpenClaw", path: "/Users/test/.openclaw", defaultPath: "/Users/test/.openclaw" },
      ],
      supportedAgents: [
        { agentId: "codex", agentLabel: "Codex" },
        { agentId: "claude", agentLabel: "Claude" },
        { agentId: "cursor", agentLabel: "Cursor" },
        { agentId: "openclaw", agentLabel: "OpenClaw" },
      ],
      savedConnectionCount: 2,
      importableSetupCount: 0,
    },
  };
}

function createOutdatedSettingsState(): SettingsState {
  const state = createSettingsState();
  const codexPersonal = createConnection("codex-personal", "Codex Personal", ["codex"]);
  const claudePersonal = createConnection("claude-personal", "Claude Personal", ["claude"]);
  state.connections = [
    codexPersonal,
    claudePersonal,
    ...state.connections,
  ];
  state.currentConnection = codexPersonal;
  state.liveConnection = codexPersonal;
  state.currentAgentConnections = [codexPersonal, claudePersonal];
  state.agents = state.agents.map((agent) => {
    if (agent.agentId === "codex") {
      return {
        ...agent,
        currentConnection: codexPersonal,
        liveConnection: codexPersonal,
        connections: [codexPersonal, ...agent.connections],
      };
    }
    if (agent.agentId === "claude") {
      return {
        ...agent,
        currentConnection: claudePersonal,
        liveConnection: claudePersonal,
        connections: [claudePersonal, ...agent.connections],
      };
    }
    return agent;
  });
  state.advanced.agentHomes = state.advanced.agentHomes.map((home) => {
    if (home.agentId === "codex") {
      return { ...home, path: "/tmp/codex-old" };
    }
    if (home.agentId === "claude") {
      return { ...home, path: home.defaultPath };
    }
    return home;
  });
  return state;
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

function readConnection(state: SettingsState, agentId: AgentId, connectionId: string): DesktopConnection {
  const connection = state.agents.find((agent) => agent.agentId === agentId)?.connections.find((entry) => entry.id === connectionId);
  if (!connection) {
    throw new Error("test connection missing");
  }
  return connection;
}

function createStorePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-profile-manager-"));
  tempDirs.push(dir);
  return join(dir, "desktop.sqlite");
}
