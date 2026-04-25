import type { AgentId } from "@nile/core/models/agent";
import type { ConnectionDefinition } from "@nile/core/models/connection";
import { StateReset, type ResetStateResult } from "@nile/core/application/local";
import type {
  BindCursorUsageResult,
  CursorUsageAutoBindResult,
  ImportDetectedSetupsResult,
  RemoveConnectionResult,
  RollbackLatestAgentResult,
} from "@nile/core/runtime-local";

import { DesktopSurface } from "../DesktopSurface";
import type { DesktopConnection, HistoryState, MenubarState, SettingsState } from "../DesktopTypes";
import { DesktopConnectionManager } from "./DesktopConnectionManager";
import type {
  DesktopAddConnectionInput,
  DesktopDescribeSavedConnectionOnboardingInput,
  DesktopConnectionSummary,
  DesktopPreparedConnectionDraft,
  DesktopSavePreparedConnectionInput,
  DesktopUpdateConnectionInput,
} from "./types";

type CachedValue<T> = {
  dirty: boolean;
  refresh: Promise<T> | null;
  value: T | null;
};

type DesktopStateStoreOptions = {
  databasePath: string;
  surface: DesktopSurface;
  connectionManager: DesktopConnectionManager;
  stateReset?: StateReset;
};

export class DesktopStateStore {
  private readonly menubarState: CachedValue<MenubarState> = { value: null, dirty: true, refresh: null };
  private readonly settingsState: CachedValue<SettingsState> = { value: null, dirty: true, refresh: null };
  private readonly historyState: CachedValue<HistoryState> = { value: null, dirty: true, refresh: null };
  private readonly connectionDefinitions: CachedValue<ConnectionDefinition[]> = { value: null, dirty: true, refresh: null };

  private readonly stateReset: StateReset;

  constructor(private readonly options: DesktopStateStoreOptions) {
    this.stateReset = options.stateReset ?? new StateReset();
  }

  peekMenubarState(): MenubarState | null {
    return this.menubarState.value;
  }

  async getMenubarState(): Promise<MenubarState> {
    return await this.readState(this.menubarState, async () => await this.options.surface.getMenubarState());
  }

  async getSettingsState(): Promise<SettingsState> {
    return await this.readState(this.settingsState, async () => await this.options.surface.getSettingsState());
  }

  async getHistoryState(): Promise<HistoryState> {
    return await this.readState(this.historyState, async () => await this.options.surface.getHistoryState());
  }

  async listConnectionDefinitions(): Promise<ConnectionDefinition[]> {
    return await this.readState(this.connectionDefinitions, async () => this.options.connectionManager.listDefinitions());
  }

  async describeConnectionOnboarding(input: DesktopAddConnectionInput) {
    return await this.options.connectionManager.describeConnectionOnboarding(input);
  }

  async describeSavedConnectionOnboarding(input: DesktopDescribeSavedConnectionOnboardingInput) {
    return await this.options.connectionManager.describeSavedConnectionOnboarding(input);
  }

  async prepareConnectionDraft(input: DesktopAddConnectionInput): Promise<DesktopPreparedConnectionDraft> {
    return await this.options.connectionManager.prepareConnectionDraft(input);
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
      this.connectionDefinitions,
    );
  }

  async switchConnection(agentId: AgentId, connectionId: string): Promise<DesktopConnection> {
    const result = await this.options.surface.switchConnection(agentId, connectionId);
    this.markDirty(this.menubarState, this.settingsState, this.historyState);
    return result;
  }

  async rollbackLatestMutation(agentId: AgentId): Promise<RollbackLatestAgentResult> {
    const result = await this.options.surface.rollbackLatestMutation(agentId);
    this.markDirty(this.menubarState, this.settingsState, this.historyState);
    return result;
  }

  async addConnection(input: DesktopAddConnectionInput): Promise<DesktopConnectionSummary> {
    const result = await this.options.connectionManager.addConnection(input);
    this.markDirty(this.menubarState, this.settingsState, this.historyState, this.connectionDefinitions);
    return result;
  }

  async updateConnection(input: DesktopUpdateConnectionInput): Promise<DesktopConnectionSummary> {
    const result = await this.options.connectionManager.updateConnection(input);
    this.markDirty(this.menubarState, this.settingsState, this.historyState, this.connectionDefinitions);
    return result;
  }

  async savePreparedConnection(input: DesktopSavePreparedConnectionInput): Promise<DesktopConnectionSummary> {
    const result = await this.options.connectionManager.savePreparedConnection(input);
    this.markDirty(this.menubarState, this.settingsState, this.historyState, this.connectionDefinitions);
    return result;
  }

  async importDetectedSetups(scanIds: AgentId[]): Promise<ImportDetectedSetupsResult> {
    const result = await this.options.surface.importDetectedSetups(scanIds);
    this.markDirty(this.menubarState, this.settingsState, this.historyState, this.connectionDefinitions);
    return result;
  }

  importCurrentConnection(agentId: AgentId): DesktopConnectionSummary {
    const result = this.options.connectionManager.importCurrentConnection(agentId);
    this.markDirty(this.menubarState, this.settingsState, this.historyState, this.connectionDefinitions);
    return result;
  }

  removeConnection(connectionId: string): RemoveConnectionResult {
    const result = this.options.connectionManager.removeConnection(connectionId);
    this.markDirty(this.menubarState, this.settingsState, this.historyState, this.connectionDefinitions);
    return result;
  }

  bindCursorUsage(connectionId: string, sessionToken: string): BindCursorUsageResult {
    const result = this.options.connectionManager.bindCursorUsage(connectionId, sessionToken);
    this.markDirty(this.menubarState, this.settingsState);
    return result;
  }

  autoBindCursorUsage(connectionId: string): CursorUsageAutoBindResult {
    const result = this.options.connectionManager.autoBindCursorUsage(connectionId);
    if (result.status === "bound") {
      this.markDirty(this.menubarState, this.settingsState);
    }
    return result;
  }

  autoBindAllCursorUsage(): CursorUsageAutoBindResult[] {
    const results = this.options.connectionManager.autoBindAllCursorUsage();
    if (results.some((result) => result.status === "bound")) {
      this.markDirty(this.menubarState, this.settingsState);
    }
    return results;
  }

  resetState(): ResetStateResult {
    const result = this.stateReset.reset(this.options.databasePath);
    this.markDirty(this.menubarState, this.settingsState, this.historyState, this.connectionDefinitions);
    return result;
  }

  private async readState<T>(cached: CachedValue<T>, refresh: () => Promise<T>): Promise<T> {
    if (!cached.dirty && cached.value !== null) {
      return cached.value;
    }
    if (cached.refresh) {
      return await cached.refresh;
    }

    cached.refresh = refresh().then((value) => {
      cached.value = value;
      cached.dirty = false;
      return value;
    }).finally(() => {
      cached.refresh = null;
    });

    return await cached.refresh;
  }

  private markDirty(...entries: Array<CachedValue<unknown>>): void {
    for (const entry of entries) {
      entry.dirty = true;
    }
  }
}
