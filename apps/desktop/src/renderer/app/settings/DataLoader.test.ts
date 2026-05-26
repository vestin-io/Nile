import { describe, expect, it, vi } from "vitest";

import { SettingsDataLoader } from "./DataLoader";
import type { HistoryState, SettingsState } from "../../shared/DesktopData";

function createHistoryState(): HistoryState {
  return {
    agents: [],
    entries: [],
  } as unknown as HistoryState;
}

function createSettingsState(): SettingsState {
  return {
    advanced: {
      credentialStorageState: {
        encryptedLocalUnlocked: false,
        encryptedLocalVaultExists: false,
      },
      defaultOpenAiAuthJsonPath: null,
      notificationHistoryLimit: 0,
      profileFeatureEnabled: false,
      releaseChannel: "stable",
      statusEntryDisplayMode: "app_entry",
    },
    agents: [],
    connections: [],
    currentConnection: null,
    currentConnectionState: null,
    detectedSetups: {
      agents: [],
    },
    liveConnection: null,
    onboarding: null,
    reconciliationState: null,
  } as unknown as SettingsState;
}

describe("SettingsDataLoader", () => {
  it("reads snapshot settings state before the follow-up data", async () => {
    const events: string[] = [];
    const loader = new SettingsDataLoader({
      getHistoryState: async () => {
        events.push("history");
        return createHistoryState();
      },
      getSettingsState: async () => {
        throw new Error("should not read live state for snapshot");
      },
      getSettingsStateSnapshot: async () => {
        events.push("snapshot");
        return createSettingsState();
      },
      listConnectionDefinitions: async () => {
        events.push("definitions");
        return [];
      },
      refreshSettings: async () => {
        events.push("refresh");
      },
    });

    const snapshot = await loader.readSnapshot();
    events.push("snapshot-ready");
    await snapshot.followup;

    expect(events).toEqual([
      "snapshot",
      "history",
      "definitions",
      "snapshot-ready",
    ]);
  });

  it("reads live settings state together with supplementary data", async () => {
    const events: string[] = [];
    const loader = new SettingsDataLoader({
      getHistoryState: async () => {
        events.push("history");
        return createHistoryState();
      },
      getSettingsState: async () => {
        events.push("live");
        return createSettingsState();
      },
      getSettingsStateSnapshot: async () => {
        throw new Error("should not read snapshot state for refresh");
      },
      listConnectionDefinitions: async () => {
        events.push("definitions");
        return [];
      },
      refreshSettings: async () => {
        events.push("refresh");
      },
    });

    const result = await loader.readRefresh();

    expect(result.definitions).toEqual([]);
    expect(events).toEqual(expect.arrayContaining(["live", "history", "definitions"]));
  });

  it("forwards refresh requests to the bridge", async () => {
    const refreshSettings = vi.fn(async () => {});
    const loader = new SettingsDataLoader({
      getHistoryState: async () => createHistoryState(),
      getSettingsState: async () => createSettingsState(),
      getSettingsStateSnapshot: async () => createSettingsState(),
      listConnectionDefinitions: async () => [],
      refreshSettings,
    });

    await loader.refreshSettings();

    expect(refreshSettings).toHaveBeenCalledTimes(1);
  });
});
