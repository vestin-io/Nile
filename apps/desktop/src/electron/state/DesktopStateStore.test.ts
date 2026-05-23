import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { RollbackLatestAgentResult } from "@nile/core/models/agent";
import type { RemoveConnectionResult, ResetStateResult } from "@nile/builtins/local";
import type { ImportDetectedSetupsResult } from "@nile/core/actions/local-setup";
import type { BindCursorUsageResult, CursorUsageAutoBindResult } from "@nile/builtins/cursor-usage";
import { SqliteDatabase } from "@nile/core/services/database";

import type { DesktopConnection, HistoryState, MenubarState, SettingsState } from "../../state/Types";
import { DesktopConnectionGateway } from "../connections/DesktopConnectionGateway";
import type { DesktopAddConnectionInput, DesktopConnectionSummary } from "../connections/contracts";
import { DesktopStateStore } from "./DesktopStateStore";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopStateStore", () => {
  it("caches completed state reads until invalidated", async () => {
    const surface = new StubSurface();
    const manager = new StubConnectionManager();
    const store = new DesktopStateStore({
      databasePath: createDatabasePath(),
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
      databasePath: createDatabasePath(),
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
      databasePath: createDatabasePath(),
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
      databasePath: createDatabasePath(),
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
      databasePath: createDatabasePath(),
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
      databasePath: createDatabasePath(),
      surface: surface as never,
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });

    await store.getMenubarState();
    await store.refreshMenubarState();

    expect(surface.getMenubarStateCalls).toBe(2);
  });

  it("primes startup menubar and settings state into cache together", async () => {
    const surface = new StubSurface();
    const databasePath = createDatabasePath();
    const store = new DesktopStateStore({
      databasePath,
      surface: surface as never,
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });

    await store.primeStartupState();

    expect(surface.primeStartupStateCalls).toBe(1);
    expect(store.peekMenubarState()).toEqual({ agents: [] });
    expect(store.peekSettingsState()).toEqual(await surface.getSettingsState());
    expect(surface.getMenubarStateCalls).toBe(0);
  });

  it("invalidates every cached desktop state when requested", async () => {
    const surface = new StubSurface();
    const manager = new StubConnectionManager();
    const store = new DesktopStateStore({
      databasePath: createDatabasePath(),
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
    const databasePath = createDatabasePath();
    const store = new DesktopStateStore({
      databasePath,
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
      databasePath,
      historyPath: "/tmp/history",
      credentialsRemoved: true,
      databaseRemoved: true,
      historyRemoved: true,
    });
    expect(stateReset.databasePaths).toEqual([databasePath]);
    expect(surface.getMenubarStateCalls).toBe(2);
    expect(surface.getSettingsStateCalls).toBe(2);
  });

  it("invalidates cached state after binding Cursor usage", async () => {
    const surface = new StubSurface();
    const gateway = new StubConnectionGateway();
    const store = new DesktopStateStore({
      databasePath: createDatabasePath(),
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
      databasePath: createDatabasePath(),
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

  it("hydrates cached menubar and settings state from the persisted desktop snapshot", async () => {
    const databasePath = createDatabasePath();
    const writerSurface = new StubSurface();
    const writer = new DesktopStateStore({
      databasePath,
      surface: writerSurface as never,
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });

    await writer.getMenubarState();
    await writer.getSettingsState();

    const readerSurface = new StubSurface();
    const reader = new DesktopStateStore({
      databasePath,
      surface: readerSurface as never,
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });

    expect(reader.peekMenubarState()).toEqual({ agents: [] });
    expect(reader.peekSettingsState()).toEqual(await writerSurface.getSettingsState());
    await expect(reader.getSettingsStateSnapshot()).resolves.toEqual(await writerSurface.getSettingsState());
    expect(readerSurface.getSettingsStateCalls).toBe(0);
    await expect(reader.getMenubarState()).resolves.toEqual({ agents: [] });
    await expect(reader.getSettingsState()).resolves.toEqual({
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
    });
    expect(readerSurface.getMenubarStateCalls).toBe(1);
    expect(readerSurface.getSettingsStateCalls).toBe(1);
  });

  it("keeps live settings refreshes after an initial snapshot read", async () => {
    const surface = new StubSurface();
    const store = new DesktopStateStore({
      databasePath: createDatabasePath(),
      surface: surface as never,
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });

    await store.getSettingsStateSnapshot();
    await store.getSettingsState();

    expect(surface.getSettingsStateCalls).toBe(2);
  });

  it("does not let startup prewarm overwrite an existing persisted settings snapshot", async () => {
    const databasePath = createDatabasePath();
    const writer = new DesktopStateStore({
      databasePath,
      surface: new UsageSurface("persisted") as never,
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });
    await writer.getSettingsState();

    const surface = new UsageSurface("prewarm");
    const store = new DesktopStateStore({
      databasePath,
      surface: surface as never,
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });

    await store.primeStartupState();

    expect(surface.primeStartupStateCalls).toBe(1);
    expect(store.peekSettingsState()?.connections[0]?.usage?.text).toBe("persisted");
  });

  it("keeps startup-prewarmed settings dirty so the first live read still refreshes", async () => {
    const surface = new StubSurface();
    const store = new DesktopStateStore({
      databasePath: createDatabasePath(),
      surface: surface as never,
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });

    await store.primeStartupState();
    expect(surface.primeStartupStateCalls).toBe(1);

    await store.getSettingsState();

    expect(surface.getSettingsStateCalls).toBe(2);
  });

  it("ignores invalid persisted settings snapshots", async () => {
    const databasePath = createDatabasePath();
    const database = SqliteDatabase.open(databasePath);
    try {
      database.exec(`
        CREATE TABLE desktop_state_snapshots (
          snapshot_key TEXT PRIMARY KEY,
          version INTEGER NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      database.run(
        `
          INSERT INTO desktop_state_snapshots (snapshot_key, version, payload, updated_at)
          VALUES ('settings_state', 1, ?, CURRENT_TIMESTAMP)
        `,
        JSON.stringify({ invalid: true }),
      );
    } finally {
      database.close();
    }

    const store = new DesktopStateStore({
      databasePath,
      surface: new StubSurface() as never,
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });

    expect(store.peekSettingsState()).toBeNull();
  });
});

function createDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-desktop-state-store-"));
  tempDirs.push(dir);
  return join(dir, "desktop.sqlite");
}

class StubSurface {
  getMenubarStateCalls = 0;
  getSettingsStateCalls = 0;
  getHistoryStateCalls = 0;
  primeStartupStateCalls = 0;

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

  async primeStartupState(): Promise<{ menubarState: MenubarState; settingsState: SettingsState }> {
    this.primeStartupStateCalls += 1;
    return {
      menubarState: {
        agents: [],
      },
      settingsState: await this.getSettingsState(),
    };
  }
}

class UsageSurface extends StubSurface {
  constructor(private readonly usageText: string) {
    super();
  }

  override async getSettingsState(): Promise<SettingsState> {
    this.getSettingsStateCalls += 1;
    return createSettingsState(this.usageText);
  }
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

function createSettingsState(usageText: string): SettingsState {
  return {
    onboarding: null,
    currentConnection: null,
    currentConnectionState: "none",
    liveConnection: null,
    reconciliationState: "unavailable",
    connections: [
      {
        id: "work",
        label: "Work",
        endpointLabel: "OpenAI",
        endpointFamily: "openai",
        authMode: "api_key",
        isCurrent: false,
        usage: {
          status: "available",
          text: usageText,
          windowLabel: "5h",
          remainingPercent: 80,
          windows: [],
        },
        activeAlertCount: 0,
        enabledAgents: [],
        configurableAgents: [],
        selectedByAgents: [],
      },
    ],
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
      savedConnectionCount: 1,
      importableSetupCount: 0,
    },
  };
}
