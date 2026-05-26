import type { Definition, HistoryState, SettingsState } from "../../shared/DesktopData";

export type SettingsSupplementaryData = {
  definitions: Definition[];
  historyState: HistoryState;
};

export type SettingsSnapshotData = {
  followup: Promise<SettingsSupplementaryData>;
  settingsState: SettingsState;
};

export type SettingsRefreshData = SettingsSupplementaryData & {
  settingsState: SettingsState;
};

type SettingsDataBridge = {
  getHistoryState(): Promise<HistoryState>;
  getSettingsState(): Promise<SettingsState>;
  getSettingsStateSnapshot(): Promise<SettingsState>;
  listConnectionDefinitions(): Promise<Definition[]>;
  refreshSettings(): Promise<SettingsState>;
};

export class SettingsDataLoader {
  constructor(private readonly bridge: SettingsDataBridge) {}

  async readSnapshot(): Promise<SettingsSnapshotData> {
    const settingsState = await this.bridge.getSettingsStateSnapshot();

    return {
      followup: this.readSupplementaryData(),
      settingsState,
    };
  }

  async readRefresh(): Promise<SettingsRefreshData> {
    const [settingsState, supplementaryData] = await Promise.all([
      this.bridge.getSettingsState(),
      this.readSupplementaryData(),
    ]);

    return {
      settingsState,
      ...supplementaryData,
    };
  }

  async refreshSettings(): Promise<SettingsRefreshData> {
    const settingsState = await this.bridge.refreshSettings();
    const supplementaryData = await this.readSupplementaryData();

    return {
      settingsState,
      ...supplementaryData,
    };
  }

  private async readSupplementaryData(): Promise<SettingsSupplementaryData> {
    const [historyState, definitions] = await Promise.all([
      this.bridge.getHistoryState(),
      this.bridge.listConnectionDefinitions(),
    ]);

    return {
      definitions,
      historyState,
    };
  }
}
