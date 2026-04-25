import { describe, expect, it } from "vitest";

import type { ConnectionDefinition } from "@nile/core/models/connection";
import type { ResetStateResult } from "@nile/core/application/local";
import type {
  BindCursorUsageResult,
  ImportDetectedSetupsResult,
  RemoveConnectionResult,
  RollbackLatestAgentResult,
} from "@nile/core/runtime-local";

import type { DesktopConnection, HistoryState, MenubarState, SettingsState } from "../DesktopTypes";
import { DesktopStateStore } from "./DesktopStateStore";
import type { DesktopAddConnectionInput, DesktopConnectionSummary } from "./types";

describe("DesktopStateStore", () => {
  it("caches completed state reads until invalidated", async () => {
    const surface = new StubSurface();
    const manager = new StubConnectionManager();
    const store = new DesktopStateStore({
      databasePath: "/tmp/test.sqlite",
      surface: surface as never,
      connectionManager: manager as never,
    });

    const first = await store.getMenubarState();
    const second = await store.getMenubarState();

    expect(first).toBe(second);
    expect(surface.getMenubarStateCalls).toBe(1);
  });

  it("deduplicates in-flight refreshes for the same state", async () => {
    const surface = new StubSurface();
    const store = new DesktopStateStore({
      databasePath: "/tmp/test.sqlite",
      surface: surface as never,
      connectionManager: new StubConnectionManager() as never,
    });

    const [first, second] = await Promise.all([
      store.getSettingsState(),
      store.getSettingsState(),
    ]);

    expect(first).toBe(second);
    expect(surface.getSettingsStateCalls).toBe(1);
  });

  it("invalidates cached state after a switch", async () => {
    const surface = new StubSurface();
    const store = new DesktopStateStore({
      databasePath: "/tmp/test.sqlite",
      surface: surface as never,
      connectionManager: new StubConnectionManager() as never,
    });

    await store.getMenubarState();
    await store.getSettingsState();

    await store.switchConnection("codex", "work");
    await store.getMenubarState();
    await store.getSettingsState();

    expect(surface.switchConnectionCalls).toEqual([["codex", "work"]]);
    expect(surface.getMenubarStateCalls).toBe(2);
    expect(surface.getSettingsStateCalls).toBe(2);
  });

  it("exposes the latest cached menubar state without triggering a refresh", async () => {
    const surface = new StubSurface();
    const store = new DesktopStateStore({
      databasePath: "/tmp/test.sqlite",
      surface: surface as never,
      connectionManager: new StubConnectionManager() as never,
    });

    expect(store.peekMenubarState()).toBeNull();
    await store.getMenubarState();

    const cached = store.peekMenubarState();
    expect(cached).toEqual({ agents: [] });
    expect(surface.getMenubarStateCalls).toBe(1);
  });

  it("forces a new menubar refresh when explicitly requested", async () => {
    const surface = new StubSurface();
    const store = new DesktopStateStore({
      databasePath: "/tmp/test.sqlite",
      surface: surface as never,
      connectionManager: new StubConnectionManager() as never,
    });

    await store.getMenubarState();
    await store.refreshMenubarState();

    expect(surface.getMenubarStateCalls).toBe(2);
  });

  it("invalidates every cached desktop state when requested", async () => {
    const surface = new StubSurface();
    const manager = new StubConnectionManager();
    const store = new DesktopStateStore({
      databasePath: "/tmp/test.sqlite",
      surface: surface as never,
      connectionManager: manager as never,
    });

    await store.getMenubarState();
    await store.getSettingsState();
    await store.getHistoryState();
    await store.listConnectionDefinitions();

    store.invalidateAll();

    await store.getMenubarState();
    await store.getSettingsState();
    await store.getHistoryState();
    await store.listConnectionDefinitions();

    expect(surface.getMenubarStateCalls).toBe(2);
    expect(surface.getSettingsStateCalls).toBe(2);
    expect(surface.getHistoryStateCalls).toBe(2);
    expect(manager.listConnectionDefinitionsCalls).toBe(2);
  });

  it("invalidates cached state after a reset", async () => {
    const surface = new StubSurface();
    const stateReset = new StubStateReset();
    const store = new DesktopStateStore({
      databasePath: "/tmp/test.sqlite",
      surface: surface as never,
      connectionManager: new StubConnectionManager() as never,
      stateReset: stateReset as never,
    });

    await store.getMenubarState();
    await store.getSettingsState();

    const result = store.resetState();
    await store.getMenubarState();
    await store.getSettingsState();

    expect(result).toEqual({
      databasePath: "/tmp/test.sqlite",
      historyPath: "/tmp/history",
      credentialsRemoved: true,
      databaseRemoved: true,
      historyRemoved: true,
    });
    expect(stateReset.databasePaths).toEqual(["/tmp/test.sqlite"]);
    expect(surface.getMenubarStateCalls).toBe(2);
    expect(surface.getSettingsStateCalls).toBe(2);
  });

  it("invalidates cached state after binding Cursor usage", async () => {
    const surface = new StubSurface();
    const manager = new StubConnectionManager();
    const store = new DesktopStateStore({
      databasePath: "/tmp/test.sqlite",
      surface: surface as never,
      connectionManager: manager as never,
    });

    await store.getMenubarState();
    await store.getSettingsState();

    const result = store.bindCursorUsage("cursor-work", "session-token");
    await store.getMenubarState();
    await store.getSettingsState();

    expect(result).toEqual({
      connectionId: "cursor-work",
      connectionLabel: "Cursor Work",
      endpointLabel: "Cursor",
      endpointFamily: "cursor",
      workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
      boundAt: "2026-05-01T00:00:00.000Z",
    });
    expect(manager.bindCursorUsageCalls).toEqual([["cursor-work", "session-token"]]);
    expect(surface.getMenubarStateCalls).toBe(2);
    expect(surface.getSettingsStateCalls).toBe(2);
  });
});

class StubSurface {
  getMenubarStateCalls = 0;
  getSettingsStateCalls = 0;
  getHistoryStateCalls = 0;
  switchConnectionCalls: Array<[string, string]> = [];

  async getMenubarState(): Promise<MenubarState> {
    this.getMenubarStateCalls += 1;
    return {
      agents: [],
    };
  }

  async getSettingsState(): Promise<SettingsState> {
    this.getSettingsStateCalls += 1;
    return {
      onboarding: null,
      currentConnection: null,
      currentConnectionState: "none",
      liveConnection: null,
      syncState: "synced",
      connections: [],
      currentAgentConnections: [],
      agents: [],
      detectedSetups: {
        mode: "empty",
        importableCount: 0,
        items: [],
      },
      advanced: {
        agentHomes: [],
        supportedAgents: [],
        savedConnectionCount: 0,
        importableSetupCount: 0,
      },
    };
  }

  async getHistoryState(): Promise<HistoryState> {
    this.getHistoryStateCalls += 1;
    return {
      agents: [],
      entries: [],
    };
  }

  async refreshMenubarUsage(): Promise<void> {}

  async switchConnection(agentId: string, connectionId: string): Promise<DesktopConnection> {
    this.switchConnectionCalls.push([agentId, connectionId]);
    return {
      id: connectionId,
      label: connectionId,
      endpointLabel: "Provider",
      endpointFamily: "openai",
      authMode: "api_key",
      isCurrent: true,
      enabledAgents: [],
      configurableAgents: [],
      selectedByAgents: [],
    };
  }

  async rollbackLatestMutation(agentId: string): Promise<RollbackLatestAgentResult> {
    return {
      agentId: agentId as RollbackLatestAgentResult["agentId"],
      rolledBackMutationId: "rolled-back",
      rollbackMutationId: "rollback",
    };
  }

  async importDetectedSetups(): Promise<ImportDetectedSetupsResult> {
    return { results: [] };
  }
}

class StubConnectionManager {
  bindCursorUsageCalls: Array<[string, string]> = [];
  listConnectionDefinitionsCalls = 0;

  listDefinitions(): ConnectionDefinition[] {
    this.listConnectionDefinitionsCalls += 1;
    return [];
  }

  async describeConnectionOnboarding() {
    return {
      configurableAgents: ["codex"],
      suggestedAgents: ["codex"],
      defaultEnabledAgents: ["codex"],
    };
  }

  async addConnection(_input: DesktopAddConnectionInput): Promise<DesktopConnectionSummary> {
    return {
      id: "new",
      label: "New",
      endpointId: "provider",
      endpointLabel: "Provider",
      endpointFamily: "openai",
      authMode: "api_key",
    };
  }

  async updateConnection(_input: { connectionId: string; label: string; enabledAgents: string[] }): Promise<DesktopConnectionSummary> {
    return {
      id: "updated",
      label: "Updated",
      endpointId: "provider",
      endpointLabel: "Provider",
      endpointFamily: "openai",
      authMode: "api_key",
    };
  }

  importCurrentConnection(): DesktopConnectionSummary {
    return {
      id: "imported",
      label: "Imported",
      endpointId: "provider",
      endpointLabel: "Provider",
      endpointFamily: "openai",
      authMode: "api_key",
    };
  }

  removeConnection(connectionId: string): RemoveConnectionResult {
    return {
      id: connectionId,
      removed: true,
      orphanedAgents: [],
    };
  }

  bindCursorUsage(connectionId: string, sessionToken: string): BindCursorUsageResult {
    this.bindCursorUsageCalls.push([connectionId, sessionToken]);
    return {
      connectionId,
      connectionLabel: "Cursor Work",
      endpointLabel: "Cursor",
      endpointFamily: "cursor",
      workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
      boundAt: "2026-05-01T00:00:00.000Z",
    };
  }

  autoBindAllCursorUsage(): Array<{ connectionId: string; status: string }> {
    return [];
  }
}

class StubStateReset {
  readonly databasePaths: string[] = [];

  reset(databasePath: string): ResetStateResult {
    this.databasePaths.push(databasePath);
    return {
      databasePath,
      historyPath: "/tmp/history",
      credentialsRemoved: true,
      databaseRemoved: true,
      historyRemoved: true,
    };
  }
}
