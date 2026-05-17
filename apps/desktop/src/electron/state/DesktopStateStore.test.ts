import { describe, expect, it } from "vitest";

import type { RollbackLatestAgentResult } from "@nile/core/models/agent";
import type { RemoveConnectionResult, ResetStateResult } from "@nile/builtins/local";
import type { ImportDetectedSetupsResult } from "@nile/core/actions/local-setup";
import type { BindCursorUsageResult, CursorUsageAutoBindResult } from "@nile/builtins/cursor-usage";

import type { DesktopConnection, HistoryState, MenubarState, SettingsState } from "../../state/Types";
import { DesktopConnectionGateway } from "../connections/DesktopConnectionGateway";
import type { DesktopAddConnectionInput, DesktopConnectionSummary } from "../connections/contracts";
import { DesktopStateStore } from "./DesktopStateStore";

describe("DesktopStateStore", () => {
  it("caches completed state reads until invalidated", async () => {
    const surface = new StubSurface();
    const manager = new StubConnectionManager();
    const store = new DesktopStateStore({
      databasePath: "/tmp/test.sqlite",
      surface: surface as never,
      connectionGateway: new StubConnectionGateway() as never,
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
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });

    const [first, second] = await Promise.all([
      store.getSettingsState(),
      store.getSettingsState(),
    ]);

    expect(first).toBe(second);
    expect(surface.getSettingsStateCalls).toBe(1);
  });

  it("does not let stale in-flight refreshes clear later invalidations", async () => {
    const surface = new DeferredMenubarSurface();
    const store = new DesktopStateStore({
      databasePath: "/tmp/test.sqlite",
      surface: surface as never,
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });
    const firstState: MenubarState = { agents: [] };
    const secondState: MenubarState = { agents: [] };

    const firstRefresh = store.getMenubarState();
    store.invalidateAll();
    const secondRefresh = store.getMenubarState();

    expect(surface.getMenubarStateCalls).toBe(2);
    surface.resolve(0, firstState);
    await expect(firstRefresh).resolves.toBe(firstState);
    expect(store.peekMenubarState()).toBeNull();

    surface.resolve(1, secondState);
    await expect(secondRefresh).resolves.toBe(secondState);
    expect(store.peekMenubarState()).toBe(secondState);
  });

  it("invalidates cached state after a switch", async () => {
    const surface = new StubSurface();
    const gateway = new StubConnectionGateway();
    const store = new DesktopStateStore({
      databasePath: "/tmp/test.sqlite",
      surface: surface as never,
      connectionGateway: gateway as never,
      connectionManager: new StubConnectionManager() as never,
    });

    await store.getMenubarState();
    await store.getSettingsState();

    await store.switchConnection("codex", "work");
    await store.getMenubarState();
    await store.getSettingsState();

    expect(gateway.switchConnectionCalls).toEqual([["codex", "work"]]);
    expect(surface.getMenubarStateCalls).toBe(2);
    expect(surface.getSettingsStateCalls).toBe(2);
  });

  it("exposes the latest cached menubar state without triggering a refresh", async () => {
    const surface = new StubSurface();
    const store = new DesktopStateStore({
      databasePath: "/tmp/test.sqlite",
      surface: surface as never,
      connectionGateway: new StubConnectionGateway() as never,
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
      connectionGateway: new StubConnectionGateway() as never,
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
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: manager as never,
    });

    await store.getMenubarState();
    await store.getSettingsState();
    await store.getHistoryState();

    store.invalidateAll();

    await store.getMenubarState();
    await store.getSettingsState();
    await store.getHistoryState();

    expect(surface.getMenubarStateCalls).toBe(2);
    expect(surface.getSettingsStateCalls).toBe(2);
    expect(surface.getHistoryStateCalls).toBe(2);
  });

  it("invalidates cached state after a reset", async () => {
    const surface = new StubSurface();
    const stateReset = new StubStateReset();
    const store = new DesktopStateStore({
      databasePath: "/tmp/test.sqlite",
      surface: surface as never,
      connectionGateway: new StubConnectionGateway() as never,
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
    const gateway = new StubConnectionGateway();
    const store = new DesktopStateStore({
      databasePath: "/tmp/test.sqlite",
      surface: surface as never,
      connectionGateway: gateway as never,
      connectionManager: new StubConnectionManager() as never,
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
    expect(gateway.bindCursorUsageCalls).toEqual([["cursor-work", "session-token"]]);
    expect(surface.getMenubarStateCalls).toBe(2);
    expect(surface.getSettingsStateCalls).toBe(2);
  });

  it("invalidates cached settings state after updating an agent connection model", async () => {
    const surface = new StubSurface();
    const gateway = new StubConnectionGateway();
    const store = new DesktopStateStore({
      databasePath: "/tmp/test.sqlite",
      surface: surface as never,
      connectionGateway: gateway as never,
      connectionManager: new StubConnectionManager() as never,
    });

    await store.getSettingsState();

    const result = store.updateAgentConnectionModel("openclaw", "work", "gpt-5.3-codex");
    await store.getSettingsState();

    expect(result).toBe("gpt-5.3-codex");
    expect(gateway.updateAgentConnectionModelCalls).toEqual([["openclaw", "work", "gpt-5.3-codex"]]);
    expect(surface.getSettingsStateCalls).toBe(2);
    expect(surface.getMenubarStateCalls).toBe(0);
  });
});

class StubSurface {
  getMenubarStateCalls = 0;
  getSettingsStateCalls = 0;
  getHistoryStateCalls = 0;

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
      reconciliationState: "unavailable",
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
}

class DeferredMenubarSurface extends StubSurface {
  private readonly pending: Array<(value: MenubarState) => void> = [];

  override async getMenubarState(): Promise<MenubarState> {
    this.getMenubarStateCalls += 1;
    return await new Promise((resolve) => {
      this.pending.push(resolve);
    });
  }

  resolve(index: number, value: MenubarState): void {
    const resolve = this.pending[index];
    if (!resolve) {
      throw new Error(`No pending menubar refresh at index ${index}`);
    }
    resolve(value);
  }
}

class StubConnectionManager {
  async describeConnectionOnboarding() {
    return {
      configurableAgents: ["codex"],
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
}

class StubConnectionGateway {
  bindCursorUsageCalls: Array<[string, string]> = [];
  switchConnectionCalls: Array<[string, string]> = [];
  updateAgentConnectionModelCalls: Array<[string, string, string | null]> = [];

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
      clearedAgents: [],
    };
  }

  updateAgentConnectionModel(agentId: string, connectionId: string, modelId: string | null): string | null {
    this.updateAgentConnectionModelCalls.push([agentId, connectionId, modelId]);
    return modelId;
  }

  async switchConnection(agentId: string, connectionId: string): Promise<DesktopConnection> {
    this.switchConnectionCalls.push([agentId, connectionId]);
    return {
      id: connectionId,
      label: connectionId,
      endpointLabel: "Provider",
      endpointFamily: "openai",
      authMode: "api_key",
      isCurrent: true,
      activeAlertCount: 0,
      enabledAgents: [],
      configurableAgents: [],
      selectedByAgents: [],
    };
  }

  importDetectedSetups(): ImportDetectedSetupsResult {
    return { results: [] };
  }

  rollbackLatestMutation(agentId: string): RollbackLatestAgentResult {
    return {
      agentId: agentId as RollbackLatestAgentResult["agentId"],
      rolledBackMutationId: "rolled-back",
      rollbackMutationId: "rollback",
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
