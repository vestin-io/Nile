import type { DesktopSurface } from "../../state/Surface";
import type { DesktopUsageRefreshMode } from "../../state/UsageCache";
import type { DesktopStatusEntryState, SettingsState } from "../../state/Types";
import { DesktopUsageStatePatcher } from "./UsageStatePatcher";

type CachedState<T> = {
  dirty: boolean;
  value: T | null;
};

export type RefreshCachedCurrentUsageOptions = {
  force?: boolean;
  mode?: DesktopUsageRefreshMode;
};

export type DesktopCachedUsageRefreshResult = {
  changed: boolean;
  hasCachedState: boolean;
  refreshed: boolean;
  settingsState: SettingsState | null;
};

type DesktopCachedUsageRefresherOptions = {
  settingsState: CachedState<SettingsState>;
  statusEntryState: CachedState<DesktopStatusEntryState>;
  surface: Pick<DesktopSurface, "refreshUsageByConnectionId">;
  usageStatePatcher?: DesktopUsageStatePatcher;
  writeSettingsState(value: SettingsState): void;
  writeStatusEntryState(value: DesktopStatusEntryState): void;
};

export class DesktopCachedUsageRefresher {
  private readonly usageStatePatcher: DesktopUsageStatePatcher;

  constructor(private readonly options: DesktopCachedUsageRefresherOptions) {
    this.usageStatePatcher = options.usageStatePatcher ?? new DesktopUsageStatePatcher();
  }

  async refreshCurrentUsage(
    options: RefreshCachedCurrentUsageOptions = {},
  ): Promise<DesktopCachedUsageRefreshResult> {
    const hasCachedState = this.options.statusEntryState.value !== null || this.options.settingsState.value !== null;
    if (!hasCachedState) {
      return {
        changed: false,
        hasCachedState: false,
        refreshed: false,
        settingsState: null,
      };
    }

    const currentConnectionIds = this.listCachedCurrentConnectionIds();
    if (currentConnectionIds.length === 0) {
      return {
        changed: false,
        hasCachedState: true,
        refreshed: false,
        settingsState: this.options.settingsState.value,
      };
    }

    const result = await this.options.surface.refreshUsageByConnectionId(currentConnectionIds, options);
    if (result.refreshedConnectionIds.length === 0) {
      return {
        changed: false,
        hasCachedState: true,
        refreshed: false,
        settingsState: this.options.settingsState.value,
      };
    }

    let changed = false;
    if (this.options.statusEntryState.value) {
      const patched = this.usageStatePatcher.patchStatusEntryState(
        this.options.statusEntryState.value,
        result.usageByConnectionId,
      );
      if (patched.changed) {
        this.options.writeStatusEntryState(patched.value);
      }
      changed = changed || patched.changed;
    }

    let settingsState = this.options.settingsState.value;
    if (settingsState) {
      const patched = this.usageStatePatcher.patchSettingsState(settingsState, result.usageByConnectionId);
      if (patched.changed) {
        this.options.writeSettingsState(patched.value);
        settingsState = patched.value;
      }
      changed = changed || patched.changed;
    }

    return {
      changed,
      hasCachedState: true,
      refreshed: true,
      settingsState,
    };
  }

  private listCachedCurrentConnectionIds(): string[] {
    const connectionIds = new Set<string>();
    for (const agent of this.options.statusEntryState.value?.agents ?? []) {
      if (agent.currentConnection?.id) {
        connectionIds.add(agent.currentConnection.id);
      }
    }
    const settingsState = this.options.settingsState.value;
    if (settingsState?.currentConnection?.id) {
      connectionIds.add(settingsState.currentConnection.id);
    }
    for (const agent of settingsState?.agents ?? []) {
      if (agent.currentConnection?.id) {
        connectionIds.add(agent.currentConnection.id);
      }
    }
    return [...connectionIds];
  }
}
