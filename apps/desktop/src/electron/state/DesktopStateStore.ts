import type { AgentId, RollbackLatestAgentResult } from "@nile/core/models/agent";
import { StateReset, type RemoveConnectionResult, type ResetStateResult } from "@nile/builtins/local";
import type { BindCursorUsageResult, CursorUsageAutoBindResult } from "@nile/builtins/cursor-usage";
import { NileLogger } from "@nile/core/services/NileLogger";

import { DesktopSurface } from "../../state/Surface";
import type { DesktopUsageRefreshMode } from "../../state/UsageCache";
import type { DesktopConnection, DesktopStatusEntryState, HistoryState, SettingsState } from "../../state/Types";
import type { DesktopNotificationHistoryFilterInput } from "../notifications/contracts";
import { ConnectionAlertOverlay } from "../alerts/Overlay";
import type { ConnectionAlertStore, CreateConnectionAlertInput, UpdateConnectionAlertInput } from "../alerts/Store";
import { DesktopConnectionGateway } from "../connections/DesktopConnectionGateway";
import { DesktopConnectionManager } from "../connections/DesktopConnectionManager";
import { DesktopNotificationHistory } from "../notifications/History";
import type {
  DesktopAddConnectionInput,
  DesktopImportCurrentConnectionInput,
  DesktopConnectionSummary,
  DesktopSavePreparedConnectionInput,
  DesktopUpdateConnectionInput,
} from "../connections/contracts";
import { ConnectionAlerts } from "./ConnectionAlerts";
import { NotificationHistoryState } from "./NotificationHistoryState";
import { DesktopStateSnapshotStore } from "./SnapshotStore";

type CachedValue<T> = {
  dirty: boolean;
  refresh: CachedRefresh<T> | null;
  value: T | null;
  version: number;
};

type CachedRefresh<T> = {
  promise: Promise<T>;
  version: number;
};

type DesktopStateStoreOptions = {
  databasePath: string;
  surface: DesktopSurface;
  connectionGateway: DesktopConnectionGateway;
  connectionManager: DesktopConnectionManager;
  connectionAlertOverlay?: ConnectionAlertOverlay;
  connectionAlertStore?: ConnectionAlertStore;
  notificationHistory?: DesktopNotificationHistory;
  stateReset?: Pick<StateReset, "reset">;
  logger?: NileLogger;
};

type GetSettingsStateOptions = {
  refreshUsage?: boolean;
  usageRefreshMode?: DesktopUsageRefreshMode;
};

export class DesktopStateStore {
  private readonly statusEntryState: CachedValue<DesktopStatusEntryState> = this.createCachedValue();
  private readonly settingsState: CachedValue<SettingsState> = this.createCachedValue();
  private readonly historyState: CachedValue<HistoryState> = this.createCachedValue();

  private readonly stateReset: Pick<StateReset, "reset">;
  private readonly connectionAlertOverlay: ConnectionAlertOverlay | null;
  private readonly connectionAlerts: ConnectionAlerts;
  private readonly notificationHistory: NotificationHistoryState;
  private readonly snapshotStore: DesktopStateSnapshotStore;
  private readonly logger: NileLogger;

  constructor(private readonly options: DesktopStateStoreOptions) {
    this.logger = this.options.logger ?? NileLogger.silent().child({ scope: "state-store" });
    this.stateReset = options.stateReset ?? new StateReset();
    this.connectionAlertOverlay = options.connectionAlertOverlay ?? null;
    this.connectionAlerts = new ConnectionAlerts(options.connectionAlertStore ?? null);
    this.notificationHistory = new NotificationHistoryState(options.notificationHistory ?? null);
    this.snapshotStore = new DesktopStateSnapshotStore(options.databasePath);
    this.hydrateSnapshots();
  }

  peekStatusEntryState(): DesktopStatusEntryState | null {
    return this.statusEntryState.value;
  }

  peekSettingsState(): SettingsState | null {
    return this.settingsState.value;
  }

  async getStatusEntryState(): Promise<DesktopStatusEntryState> {
    return await this.readState(this.statusEntryState, async () => await this.options.surface.getStatusEntryState());
  }

  async getSettingsState(options: GetSettingsStateOptions = {}): Promise<SettingsState> {
    if (options.refreshUsage === false) {
      const state = await this.options.surface.getSettingsState(options);
      return this.connectionAlertOverlay ? this.connectionAlertOverlay.decorateSettingsState(state) : state;
    }

    return await this.readState(this.settingsState, async () => {
      const state = await this.options.surface.getSettingsState({
        ...options,
        usageRefreshMode: options.usageRefreshMode ?? "auto",
      });
      return this.connectionAlertOverlay ? this.connectionAlertOverlay.decorateSettingsState(state) : state;
    });
  }

  async getSettingsStateSnapshot(): Promise<SettingsState> {
    if (this.settingsState.value) {
      return this.settingsState.value;
    }

    const state = await this.options.surface.getSettingsState({ refreshUsage: false });
    const decorated = this.connectionAlertOverlay ? this.connectionAlertOverlay.decorateSettingsState(state) : state;
    this.storeSnapshotValue(this.settingsState, decorated);
    return decorated;
  }

  async getHistoryState(): Promise<HistoryState> {
    return await this.readState(this.historyState, async () => await this.options.surface.getHistoryState());
  }

  async primeStartupState(): Promise<void> {
    const statusEntryVersion = this.statusEntryState.version;
    const settingsVersion = this.settingsState.version;
    const result = await this.options.surface.primeStartupState();
    if (this.statusEntryState.version === statusEntryVersion) {
      this.storeResolvedValue(this.statusEntryState, result.statusEntryState);
    }
    if (this.settingsState.version === settingsVersion) {
      const shouldPreserveSnapshot = this.settingsState.value !== null && this.settingsState.dirty;
      if (shouldPreserveSnapshot) {
        return;
      }
      const settingsState = this.connectionAlertOverlay
        ? this.connectionAlertOverlay.decorateSettingsState(result.settingsState)
        : result.settingsState;
      this.storeSnapshotValue(this.settingsState, settingsState);
    }
  }

  getNotificationHistory(filter?: DesktopNotificationHistoryFilterInput) {
    return this.notificationHistory.list(filter);
  }

  getNotificationHistoryConnections(filter?: DesktopNotificationHistoryFilterInput) {
    return this.notificationHistory.listConnections(filter);
  }

  hasUnreadNotifications(): boolean {
    return this.notificationHistory.hasUnread();
  }

  markNotificationHistoryRead(entryIds: string[]): void {
    this.notificationHistory.markRead(entryIds);
  }

  markNotificationHistoryReadByFilter(filter?: DesktopNotificationHistoryFilterInput): void {
    this.notificationHistory.markReadByFilter(filter);
  }

  async refreshStatusEntryUsage(options?: { mode?: DesktopUsageRefreshMode }): Promise<void> {
    await this.options.surface.refreshStatusEntryUsage(options);
    this.markDirty(this.statusEntryState, this.settingsState);
  }

  async refreshStatusEntryState(): Promise<DesktopStatusEntryState> {
    this.statusEntryState.dirty = true;
    return await this.getStatusEntryState();
  }

  invalidateAll(): void {
    this.markDirty(
      this.statusEntryState,
      this.settingsState,
      this.historyState,
    );
  }

  async switchConnection(agentId: AgentId, connectionId: string): Promise<DesktopConnection> {
    return await this.runAsyncMutation(
      async () => await this.options.connectionGateway.switchConnection(agentId, connectionId),
      this.statusEntryState,
      this.settingsState,
      this.historyState,
    );
  }

  async rollbackLatestMutation(agentId: AgentId): Promise<RollbackLatestAgentResult> {
    return await this.runAsyncMutation(
      async () => this.options.connectionGateway.rollbackLatestMutation(agentId),
      this.statusEntryState,
      this.settingsState,
      this.historyState,
    );
  }

  async addConnection(input: DesktopAddConnectionInput): Promise<DesktopConnectionSummary> {
    return await this.runAsyncMutation(
      async () => await this.options.connectionManager.addConnection(input),
      this.statusEntryState,
      this.settingsState,
      this.historyState,
    );
  }

  async updateConnection(input: DesktopUpdateConnectionInput): Promise<DesktopConnectionSummary> {
    return await this.runAsyncMutation(
      async () => await this.options.connectionManager.updateConnection(input),
      this.statusEntryState,
      this.settingsState,
      this.historyState,
    );
  }

  async savePreparedConnection(input: DesktopSavePreparedConnectionInput): Promise<DesktopConnectionSummary> {
    return await this.runAsyncMutation(
      async () => await this.options.connectionManager.savePreparedConnection(input),
      this.statusEntryState,
      this.settingsState,
      this.historyState,
    );
  }

  async importCurrentConnection(input: DesktopImportCurrentConnectionInput): Promise<DesktopConnectionSummary> {
    const startedAt = Date.now();
    this.logger.info("desktop.import_current_connection.state_store.start", {
      agentId: input.agentId,
      credentialStorageBackend: input.credentialStorageBackend ?? "unset",
    });
    try {
      return await this.runAsyncMutation(
        async () => {
          const result = await this.options.connectionGateway.importCurrentConnection(input);
        this.logger.info("desktop.import_current_connection.state_store.succeeded", {
            agentId: input.agentId,
            connectionId: result.id,
            reused: result.reused ?? false,
            durationMs: Date.now() - startedAt,
          });
          return result;
        },
        this.statusEntryState,
        this.settingsState,
        this.historyState,
      );
    } catch (error) {
      this.logger.error("desktop.import_current_connection.state_store.failed", error, {
        agentId: input.agentId,
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  removeConnection(connectionId: string): RemoveConnectionResult {
    return this.runMutation(
      () => this.options.connectionGateway.removeConnection(connectionId),
      this.statusEntryState,
      this.settingsState,
      this.historyState,
    );
  }

  updateAgentConnectionModel(agentId: AgentId, connectionId: string, modelId: string | null): string | null {
    return this.runMutation(
      () => this.options.connectionGateway.updateAgentConnectionModel(agentId, connectionId, modelId),
      this.settingsState,
    );
  }

  bindCursorUsage(connectionId: string, sessionToken: string): BindCursorUsageResult {
    return this.runMutation(
      () => this.options.connectionGateway.bindCursorUsage(connectionId, sessionToken),
      this.statusEntryState,
      this.settingsState,
    );
  }

  createConnectionAlert(input: CreateConnectionAlertInput) {
    return this.runMutation(
      () => this.connectionAlerts.create(input),
      this.settingsState,
    );
  }

  updateConnectionAlert(input: UpdateConnectionAlertInput) {
    return this.runMutation(
      () => this.connectionAlerts.update(input),
      this.settingsState,
    );
  }

  deleteConnectionAlert(connectionId: string, alertId: string): void {
    this.runMutation(
      () => this.connectionAlerts.delete(connectionId, alertId),
      this.settingsState,
    );
  }

  autoBindAllCursorUsage(): CursorUsageAutoBindResult[] {
    const results = this.options.connectionGateway.autoBindAllCursorUsage();
    if (results.some((result) => result.status === "bound")) {
      this.markDirty(this.statusEntryState, this.settingsState);
    }
    return results;
  }

  resetState(): ResetStateResult {
    return this.runMutation(
      () => this.stateReset.reset(this.options.databasePath),
      this.statusEntryState,
      this.settingsState,
      this.historyState,
    );
  }

  private async readState<T>(cached: CachedValue<T>, refresh: () => Promise<T>): Promise<T> {
    if (!cached.dirty && cached.value !== null) {
      return cached.value;
    }
    if (cached.refresh && cached.refresh.version === cached.version) {
      return await cached.refresh.promise;
    }

    const version = cached.version;
    let refreshPromise: Promise<T>;
    refreshPromise = refresh().then((value) => {
      if (cached.version === version) {
        this.storeResolvedValue(cached, value);
      }
      return value;
    }).finally(() => {
      if (cached.refresh?.promise === refreshPromise) {
        cached.refresh = null;
      }
    });
    cached.refresh = { promise: refreshPromise, version };

    return await refreshPromise;
  }

  private markDirty(...entries: Array<CachedValue<unknown>>): void {
    for (const entry of entries) {
      entry.version += 1;
      entry.dirty = true;
    }
  }

  private runMutation<TResult>(
    work: () => TResult,
    ...dirtyStates: Array<CachedValue<unknown>>
  ): TResult {
    const result = work();
    this.markDirty(...dirtyStates);
    return result;
  }

  private async runAsyncMutation<TResult>(
    work: () => Promise<TResult>,
    ...dirtyStates: Array<CachedValue<unknown>>
  ): Promise<TResult> {
    const result = await work();
    this.markDirty(...dirtyStates);
    return result;
  }

  private createCachedValue<T>(): CachedValue<T> {
    return {
      value: null,
      dirty: true,
      refresh: null,
      version: 0,
    };
  }

  private storeResolvedValue<T>(cached: CachedValue<T>, value: T): void {
    cached.value = value;
    cached.dirty = false;
    this.persistSnapshot(cached, value);
  }

  private storeSnapshotValue<T>(cached: CachedValue<T>, value: T): void {
    cached.value = value;
    cached.dirty = true;
    this.persistSnapshot(cached, value);
  }

  private hydrateSnapshots(): void {
    const snapshot = this.snapshotStore.read();
    if (snapshot.statusEntryState) {
      this.statusEntryState.value = snapshot.statusEntryState;
      this.statusEntryState.dirty = true;
    }
    if (snapshot.settingsState) {
      this.settingsState.value = snapshot.settingsState;
      this.settingsState.dirty = true;
    }
  }

  private persistSnapshot<T>(cached: CachedValue<T>, value: T): void {
    if (cached === this.statusEntryState) {
      this.snapshotStore.writeStatusEntryState(value as DesktopStatusEntryState);
      return;
    }
    if (cached === this.settingsState) {
      this.snapshotStore.writeSettingsState(value as SettingsState);
    }
  }
}
