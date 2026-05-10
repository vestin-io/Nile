import type { AgentId, RollbackLatestAgentResult } from "@nile/core/models/agent";
import { StateReset, type CursorUsageAutoBindResult, type RemoveConnectionResult, type ResetStateResult } from "@nile/core/application/local";
import type { ImportDetectedSetupsResult } from "@nile/core/actions/local-state";
import type { BindCursorUsageResult } from "@nile/core/actions/usage/cursor";

import { DesktopSurface } from "../../state/Surface";
import type { DesktopConnection, HistoryState, MenubarState, SettingsState } from "../../state/Types";
import type { DesktopNotificationHistoryFilterInput } from "../notifications/contracts";
import { ConnectionAlertOverlay } from "../alerts/Overlay";
import type { ConnectionAlertStore, CreateConnectionAlertInput, UpdateConnectionAlertInput } from "../alerts/Store";
import { DesktopConnectionGateway } from "../connections/DesktopConnectionGateway";
import { DesktopConnectionManager } from "../connections/DesktopConnectionManager";
import { DesktopNotificationHistory } from "../notifications/History";
import type {
  DesktopAddConnectionInput,
  DesktopConnectionSummary,
  DesktopSavePreparedConnectionInput,
  DesktopUpdateConnectionInput,
} from "../connections/contracts";
import { ConnectionAlerts } from "./ConnectionAlerts";
import { NotificationHistoryState } from "./NotificationHistoryState";

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
};

type GetSettingsStateOptions = {
  refreshUsage?: boolean;
};

export class DesktopStateStore {
  private readonly menubarState: CachedValue<MenubarState> = this.createCachedValue();
  private readonly settingsState: CachedValue<SettingsState> = this.createCachedValue();
  private readonly historyState: CachedValue<HistoryState> = this.createCachedValue();

  private readonly stateReset: Pick<StateReset, "reset">;
  private readonly connectionAlertOverlay: ConnectionAlertOverlay | null;
  private readonly connectionAlerts: ConnectionAlerts;
  private readonly notificationHistory: NotificationHistoryState;

  constructor(private readonly options: DesktopStateStoreOptions) {
    this.stateReset = options.stateReset ?? new StateReset();
    this.connectionAlertOverlay = options.connectionAlertOverlay ?? null;
    this.connectionAlerts = new ConnectionAlerts(options.connectionAlertStore ?? null);
    this.notificationHistory = new NotificationHistoryState(options.notificationHistory ?? null);
  }

  peekMenubarState(): MenubarState | null {
    return this.menubarState.value;
  }

  peekSettingsState(): SettingsState | null {
    return this.settingsState.value;
  }

  async getMenubarState(): Promise<MenubarState> {
    return await this.readState(this.menubarState, async () => await this.options.surface.getMenubarState());
  }

  async getSettingsState(options: GetSettingsStateOptions = {}): Promise<SettingsState> {
    return await this.readState(this.settingsState, async () => {
      const state = await this.options.surface.getSettingsState(options);
      return this.connectionAlertOverlay ? this.connectionAlertOverlay.decorateSettingsState(state) : state;
    });
  }

  async getHistoryState(): Promise<HistoryState> {
    return await this.readState(this.historyState, async () => await this.options.surface.getHistoryState());
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

  async refreshMenubarUsage(): Promise<void> {
    await this.options.surface.refreshMenubarUsage();
    this.markDirty(this.menubarState, this.settingsState);
  }

  async refreshMenubarState(): Promise<MenubarState> {
    this.menubarState.dirty = true;
    return await this.getMenubarState();
  }

  invalidateAll(): void {
    this.markDirty(
      this.menubarState,
      this.settingsState,
      this.historyState,
    );
  }

  async switchConnection(agentId: AgentId, connectionId: string): Promise<DesktopConnection> {
    return await this.runAsyncMutation(
      async () => await this.options.connectionGateway.switchConnection(agentId, connectionId),
      this.menubarState,
      this.settingsState,
      this.historyState,
    );
  }

  async rollbackLatestMutation(agentId: AgentId): Promise<RollbackLatestAgentResult> {
    return await this.runAsyncMutation(
      async () => this.options.connectionGateway.rollbackLatestMutation(agentId),
      this.menubarState,
      this.settingsState,
      this.historyState,
    );
  }

  async addConnection(input: DesktopAddConnectionInput): Promise<DesktopConnectionSummary> {
    return await this.runAsyncMutation(
      async () => await this.options.connectionManager.addConnection(input),
      this.menubarState,
      this.settingsState,
      this.historyState,
    );
  }

  async updateConnection(input: DesktopUpdateConnectionInput): Promise<DesktopConnectionSummary> {
    return await this.runAsyncMutation(
      async () => await this.options.connectionManager.updateConnection(input),
      this.menubarState,
      this.settingsState,
      this.historyState,
    );
  }

  async savePreparedConnection(input: DesktopSavePreparedConnectionInput): Promise<DesktopConnectionSummary> {
    return await this.runAsyncMutation(
      async () => await this.options.connectionManager.savePreparedConnection(input),
      this.menubarState,
      this.settingsState,
      this.historyState,
    );
  }

  async importDetectedSetups(scanIds: AgentId[]): Promise<ImportDetectedSetupsResult> {
    return await this.runAsyncMutation(
      async () => this.options.connectionGateway.importDetectedSetups(scanIds),
      this.menubarState,
      this.settingsState,
      this.historyState,
    );
  }

  importCurrentConnection(agentId: AgentId): DesktopConnectionSummary {
    return this.runMutation(
      () => this.options.connectionGateway.importCurrentConnection(agentId),
      this.menubarState,
      this.settingsState,
      this.historyState,
    );
  }

  removeConnection(connectionId: string): RemoveConnectionResult {
    return this.runMutation(
      () => this.options.connectionGateway.removeConnection(connectionId),
      this.menubarState,
      this.settingsState,
      this.historyState,
    );
  }

  bindCursorUsage(connectionId: string, sessionToken: string): BindCursorUsageResult {
    return this.runMutation(
      () => this.options.connectionGateway.bindCursorUsage(connectionId, sessionToken),
      this.menubarState,
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
      this.markDirty(this.menubarState, this.settingsState);
    }
    return results;
  }

  resetState(): ResetStateResult {
    return this.runMutation(
      () => this.stateReset.reset(this.options.databasePath),
      this.menubarState,
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
        cached.value = value;
        cached.dirty = false;
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
}
