import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { RollbackLatestAgentResult } from "@nile/core/models/agent";
import type { RemoveConnectionResult, ResetStateResult } from "@nile/builtins/local";
import type { BindCursorUsageResult, CursorUsageAutoBindResult } from "@nile/builtins/cursor-usage";
import { SqliteDatabase } from "@nile/core/services/database";

import type { DesktopConnection, DesktopStatusEntryState, HistoryState, SettingsState } from "../../state/Types";
import type { DesktopUsageRefreshResult } from "../../state/UsageCache";
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

    const first = await store.getStatusEntryState();
    const second = await store.getStatusEntryState();

    expect(first).toBe(second);
    expect(surface.getStatusEntryStateCalls).toBe(1);
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
    const surface = new DeferredStatusEntrySurface();
    const store = new DesktopStateStore({
      databasePath: createDatabasePath(),
      surface: surface as never,
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });
    const firstState: DesktopStatusEntryState = { agents: [] };
    const secondState: DesktopStatusEntryState = { agents: [] };

    const firstRefresh = store.getStatusEntryState();
    store.invalidateAll();
    const secondRefresh = store.getStatusEntryState();

    expect(surface.getStatusEntryStateCalls).toBe(2);
    surface.resolve(0, firstState);
    await expect(firstRefresh).resolves.toBe(firstState);
    expect(store.peekStatusEntryState()).toBeNull();

    surface.resolve(1, secondState);
    await expect(secondRefresh).resolves.toBe(secondState);
    expect(store.peekStatusEntryState()).toBe(secondState);
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

    await store.getStatusEntryState();
    await store.getSettingsState();

    await store.switchConnection("codex", "work");
    await store.getStatusEntryState();
    await store.getSettingsState();

    expect(gateway.switchConnectionCalls).toEqual([["codex", "work"]]);
    expect(surface.getStatusEntryStateCalls).toBe(2);
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

    expect(store.peekStatusEntryState()).toBeNull();
    await store.getStatusEntryState();

    const cached = store.peekStatusEntryState();
    expect(cached).toEqual({ agents: [] });
    expect(surface.getStatusEntryStateCalls).toBe(1);
  });

  it("forces a new menubar refresh when explicitly requested", async () => {
    const surface = new StubSurface();
    const store = new DesktopStateStore({
      databasePath: createDatabasePath(),
      surface: surface as never,
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });

    await store.getStatusEntryState();
    await store.refreshStatusEntryState();

    expect(surface.getStatusEntryStateCalls).toBe(2);
  });

  it("refreshes menubar and settings state together through a shared surface read", async () => {
    const surface = new StubSurface();
    const store = new DesktopStateStore({
      databasePath: createDatabasePath(),
      surface: surface as never,
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });

    const settingsState = await store.refreshDesktopState({ usageRefreshMode: "manual" });

    expect(settingsState).toEqual({
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
        credentialStorageMode: null,
        credentialStorageModeMixed: false,
      },
    });
    expect(surface.refreshDesktopStateCalls).toEqual([{
      refreshSettingsUsage: false,
      usageRefreshMode: "manual",
    }]);
    expect(surface.getStatusEntryStateCalls).toBe(0);
    expect(surface.getSettingsStateCalls).toBe(1);
    expect(store.peekStatusEntryState()).toEqual({ agents: [] });
    expect(store.peekSettingsState()).toEqual(settingsState);
  });

  it("refreshes cached current usage without reloading desktop state", async () => {
    const surface = new CachedUsageSurface();
    const store = new DesktopStateStore({
      databasePath: createDatabasePath(),
      surface: surface as never,
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });

    await store.getStatusEntryState();
    await store.getSettingsState();
    const result = await store.refreshCachedCurrentUsage({ mode: "auto" });

    expect(result).toEqual({
      changed: true,
      hasCachedState: true,
      refreshed: true,
      settingsState: createSettingsState("refreshed"),
    });
    expect(surface.getStatusEntryStateCalls).toBe(1);
    expect(surface.getSettingsStateCalls).toBe(1);
    expect(surface.refreshDesktopStateCalls).toEqual([]);
    expect(surface.refreshUsageByConnectionIdCalls).toEqual([{
      connectionIds: ["work"],
      options: { mode: "auto" },
    }]);
    expect(store.peekStatusEntryState()).toEqual(createStatusEntryState("refreshed"));
    expect(store.peekSettingsState()).toEqual(createSettingsState("refreshed"));
  });

  it("keeps automatic usage refreshes silent when the cache is still fresh", async () => {
    const surface = new CacheHitUsageSurface();
    const store = new DesktopStateStore({
      databasePath: createDatabasePath(),
      surface: surface as never,
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });

    await store.getStatusEntryState();
    await store.getSettingsState();
    const result = await store.refreshCachedCurrentUsage({ mode: "auto" });

    expect(result).toEqual({
      changed: false,
      hasCachedState: true,
      refreshed: false,
      settingsState: createSettingsState("cached"),
    });
    expect(surface.refreshUsageByConnectionIdCalls).toEqual([{
      connectionIds: ["work"],
      options: { mode: "auto" },
    }]);
    expect(store.peekStatusEntryState()).toEqual(createStatusEntryState("cached"));
    expect(store.peekSettingsState()).toEqual(createSettingsState("cached"));
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
    expect(store.peekStatusEntryState()).toEqual({ agents: [] });
    expect(store.peekSettingsState()).toEqual(await surface.getSettingsState());
    expect(surface.getStatusEntryStateCalls).toBe(0);
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

    await store.getStatusEntryState();
    await store.getSettingsState();
    await store.getHistoryState();

    store.invalidateAll();

    await store.getStatusEntryState();
    await store.getSettingsState();
    await store.getHistoryState();

    expect(surface.getStatusEntryStateCalls).toBe(2);
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

    await store.getStatusEntryState();
    await store.getSettingsState();

    const result = store.resetState();
    await store.getStatusEntryState();
    await store.getSettingsState();

    expect(result).toEqual({
      databasePath,
      historyPath: "/tmp/history",
      credentialsRemoved: true,
      databaseRemoved: true,
      historyRemoved: true,
    });
    expect(stateReset.databasePaths).toEqual([databasePath]);
    expect(surface.getStatusEntryStateCalls).toBe(2);
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

    await store.getStatusEntryState();
    await store.getSettingsState();

    const result = store.bindCursorUsage("cursor-work", "session-token");
    await store.getStatusEntryState();
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
    expect(surface.getStatusEntryStateCalls).toBe(2);
    expect(surface.getSettingsStateCalls).toBe(2);
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

    await writer.getStatusEntryState();
    await writer.getSettingsState();

    const readerSurface = new StubSurface();
    const reader = new DesktopStateStore({
      databasePath,
      surface: readerSurface as never,
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });

    expect(reader.peekStatusEntryState()).toEqual({ agents: [] });
    expect(reader.peekSettingsState()).toEqual(await writerSurface.getSettingsState());
    await expect(reader.getSettingsStateSnapshot()).resolves.toEqual(await writerSurface.getSettingsState());
    expect(readerSurface.getSettingsStateCalls).toBe(0);
    await expect(reader.getStatusEntryState()).resolves.toEqual({ agents: [] });
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
        credentialStorageMode: null,
        credentialStorageModeMixed: false,
      },
    });
    expect(readerSurface.getStatusEntryStateCalls).toBe(1);
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

  it("does not let refreshUsage:false settings reads satisfy later live reads", async () => {
    const surface = new RefreshAwareSettingsSurface();
    const store = new DesktopStateStore({
      databasePath: createDatabasePath(),
      surface: surface as never,
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });

    const partial = await store.getSettingsState({ refreshUsage: false });
    const live = await store.getSettingsState();

    expect(partial.connections[0]?.usage?.text).toBe("partial");
    expect(live.connections[0]?.usage?.text).toBe("live");
    expect(surface.calls).toEqual([false, true]);
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

  it("passes explicit settings usage refresh mode through to the surface read", async () => {
    const surface = new StubSurface();
    const store = new DesktopStateStore({
      databasePath: createDatabasePath(),
      surface: surface as never,
      connectionGateway: new StubConnectionGateway() as never,
      connectionManager: new StubConnectionManager() as never,
    });

    await store.getSettingsState({ usageRefreshMode: "manual" });

    expect(surface.getSettingsStateOptions).toEqual([{ usageRefreshMode: "manual" }]);
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
  getStatusEntryStateCalls = 0;
  getSettingsStateCalls = 0;
  getSettingsStateOptions: Array<{ refreshUsage?: boolean; usageRefreshMode?: "auto" | "manual" }> = [];
  getHistoryStateCalls = 0;
  primeStartupStateCalls = 0;
  refreshDesktopStateCalls: Array<{ refreshSettingsUsage?: boolean; usageRefreshMode?: "auto" | "manual" }> = [];
  refreshUsageByConnectionIdCalls: Array<{
    connectionIds: Array<string | null>;
    options?: { force?: boolean; mode?: "auto" | "manual" };
  }> = [];

  async getStatusEntryState(): Promise<DesktopStatusEntryState> {
    this.getStatusEntryStateCalls += 1;
    return {
      agents: [],
    };
  }

  async getSettingsState(
    options: { refreshUsage?: boolean; usageRefreshMode?: "auto" | "manual" } = {},
  ): Promise<SettingsState> {
    this.getSettingsStateCalls += 1;
    this.getSettingsStateOptions.push(options);
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
        credentialStorageMode: null,
        credentialStorageModeMixed: false,
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

  async refreshUsageByConnectionId(
    connectionIds: Array<string | null>,
    options?: { force?: boolean; mode?: "auto" | "manual" },
  ): Promise<DesktopUsageRefreshResult> {
    this.refreshUsageByConnectionIdCalls.push({ connectionIds, options });
    return {
      refreshedConnectionIds: [],
      usageByConnectionId: new Map(
        connectionIds.filter((connectionId): connectionId is string => connectionId !== null).map((connectionId) => [
          connectionId,
          null,
        ]),
      ),
    };
  }

  async refreshDesktopState(
    options: { refreshSettingsUsage?: boolean; usageRefreshMode?: "auto" | "manual" } = {},
  ): Promise<{ statusEntryState: DesktopStatusEntryState; settingsState: SettingsState }> {
    this.refreshDesktopStateCalls.push(options);
    return {
      statusEntryState: {
        agents: [],
      },
      settingsState: await this.getSettingsState({
        refreshUsage: options.refreshSettingsUsage,
        usageRefreshMode: options.usageRefreshMode,
      }),
    };
  }

  async primeStartupState(): Promise<{ statusEntryState: DesktopStatusEntryState; settingsState: SettingsState }> {
    this.primeStartupStateCalls += 1;
    return {
      statusEntryState: {
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

class CachedUsageSurface extends StubSurface {
  override async getStatusEntryState(): Promise<DesktopStatusEntryState> {
    this.getStatusEntryStateCalls += 1;
    return createStatusEntryState("cached");
  }

  override async getSettingsState(): Promise<SettingsState> {
    this.getSettingsStateCalls += 1;
    return createSettingsState("cached");
  }

  override async refreshUsageByConnectionId(
    connectionIds: Array<string | null>,
    options?: { force?: boolean; mode?: "auto" | "manual" },
  ): Promise<DesktopUsageRefreshResult> {
    this.refreshUsageByConnectionIdCalls.push({ connectionIds, options });
    return {
      refreshedConnectionIds: ["work"],
      usageByConnectionId: new Map([["work", createUsageState("refreshed")]]),
    };
  }
}

class CacheHitUsageSurface extends StubSurface {
  override async getStatusEntryState(): Promise<DesktopStatusEntryState> {
    this.getStatusEntryStateCalls += 1;
    return createStatusEntryState("cached");
  }

  override async getSettingsState(): Promise<SettingsState> {
    this.getSettingsStateCalls += 1;
    return createSettingsState("cached");
  }

  override async refreshUsageByConnectionId(
    connectionIds: Array<string | null>,
    options?: { force?: boolean; mode?: "auto" | "manual" },
  ): Promise<DesktopUsageRefreshResult> {
    this.refreshUsageByConnectionIdCalls.push({ connectionIds, options });
    return {
      refreshedConnectionIds: [],
      usageByConnectionId: new Map([["work", createUsageState("cached")]]),
    };
  }
}

class RefreshAwareSettingsSurface extends StubSurface {
  readonly calls: boolean[] = [];

  override async getSettingsState(options?: { refreshUsage?: boolean }): Promise<SettingsState> {
    this.getSettingsStateCalls += 1;
    const isLive = options?.refreshUsage !== false;
    this.calls.push(isLive);
    return createSettingsState(isLive ? "live" : "partial");
  }
}

class DeferredStatusEntrySurface extends StubSurface {
  private readonly pending: Array<(value: DesktopStatusEntryState) => void> = [];

  override async getStatusEntryState(): Promise<DesktopStatusEntryState> {
    this.getStatusEntryStateCalls += 1;
    return await new Promise((resolve) => {
      this.pending.push(resolve);
    });
  }

  resolve(index: number, value: DesktopStatusEntryState): void {
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
    currentConnection: {
      id: "work",
      label: "Work",
      endpointLabel: "OpenAI",
      endpointFamily: "openai",
      authMode: "api_key",
      isCurrent: true,
      usage: createUsageState(usageText),
      activeAlertCount: 0,
      enabledAgents: [],
      configurableAgents: [],
      selectedByAgents: [],
    },
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
        usage: createUsageState(usageText),
        activeAlertCount: 0,
        enabledAgents: [],
        configurableAgents: [],
        selectedByAgents: [],
      },
    ],
    currentAgentConnections: [],
    agents: [
      {
        agentId: "codex",
        agentLabel: "Codex",
        canRollback: false,
        latestRollbackableMutationId: null,
        currentConnection: {
          id: "work",
          label: "Work",
          endpointLabel: "OpenAI",
          endpointFamily: "openai",
          authMode: "api_key",
          isCurrent: true,
          usage: createUsageState(usageText),
          activeAlertCount: 0,
          enabledAgents: [],
          configurableAgents: [],
          selectedByAgents: [],
        },
        currentUsage: createUsageState(usageText),
        currentConnectionState: "saved",
        liveConnection: null,
        reconciliationState: "unavailable",
        connections: [
          {
            id: "work",
            label: "Work",
            endpointLabel: "OpenAI",
            endpointFamily: "openai",
            authMode: "api_key",
            isCurrent: true,
            usage: createUsageState(usageText),
            activeAlertCount: 0,
            enabledAgents: [],
            configurableAgents: [],
            selectedByAgents: [],
          },
        ],
      },
    ],
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
      credentialStorageMode: "system_secure_storage",
      credentialStorageModeMixed: false,
    },
  };
}

function createStatusEntryState(usageText: string): DesktopStatusEntryState {
  return {
    agents: [
      {
        agentId: "codex",
        agentLabel: "Codex",
        currentConnection: {
          id: "work",
          label: "Work",
          endpointLabel: "OpenAI",
          endpointFamily: "openai",
          authMode: "api_key",
          isCurrent: true,
          usage: createUsageState(usageText),
          activeAlertCount: 0,
          enabledAgents: [],
          configurableAgents: [],
          selectedByAgents: [],
        },
        currentUsage: createUsageState(usageText),
        connections: [
          {
            id: "work",
            label: "Work",
            endpointLabel: "OpenAI",
            endpointFamily: "openai",
            authMode: "api_key",
            isCurrent: true,
            usage: createUsageState(usageText),
            activeAlertCount: 0,
            enabledAgents: [],
            configurableAgents: [],
            selectedByAgents: [],
          },
        ],
      },
    ],
  };
}

function createUsageState(usageText: string) {
  return {
    status: "available" as const,
    text: usageText,
    windowLabel: "5h",
    remainingPercent: 80,
    windows: [],
  };
}
