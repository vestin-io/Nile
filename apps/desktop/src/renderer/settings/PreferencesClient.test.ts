import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DesktopPreferences } from "../../state/DesktopPreferences";
import { DesktopPreferencesClient } from "./PreferencesClient";

describe("DesktopPreferencesClient", () => {
  beforeEach(() => {
    const unsubscribe = vi.fn();
    (globalThis as { window?: unknown }).window = {
      nileDesktop: {
        preferences: {
          getDesktopPreferences: vi.fn(async () => createPreferences()),
          setDesktopPreferences: vi.fn(async (preferences: DesktopPreferences) => preferences),
          migrateDesktopPreferences: vi.fn(async (raw: string | null) => ({
            ...createPreferences(),
            language: raw ? "zh" as const : "en" as const,
          })),
        },
      },
      nileDesktopEvents: {
        onPreferencesChanged: vi.fn(() => unsubscribe),
        onLocalStateReset: vi.fn(() => unsubscribe),
        onNotificationHistoryChanged: vi.fn(() => unsubscribe),
        onStateChanged: vi.fn(() => unsubscribe),
        onNotificationTarget: vi.fn(() => unsubscribe),
      },
    } as unknown;
  });

  it("loads preferences through the desktop bridge", async () => {
    const client = new DesktopPreferencesClient();
    const testWindow = window as unknown as {
      nileDesktop: {
        preferences: {
          getDesktopPreferences: ReturnType<typeof vi.fn>;
          setDesktopPreferences: ReturnType<typeof vi.fn>;
          migrateDesktopPreferences: ReturnType<typeof vi.fn>;
        };
      };
    };

    await expect(client.load()).resolves.toEqual(createPreferences());
    expect(testWindow.nileDesktop.preferences.getDesktopPreferences).toHaveBeenCalledTimes(1);
  });

  it("saves preferences through the desktop bridge", async () => {
    const client = new DesktopPreferencesClient();
    const testWindow = window as unknown as {
      nileDesktop: {
        preferences: {
          setDesktopPreferences: ReturnType<typeof vi.fn>;
        };
      };
    };
    const next = {
      ...createPreferences(),
      theme: "dark" as const,
    };

    await expect(client.save(next)).resolves.toEqual(next);
    expect(testWindow.nileDesktop.preferences.setDesktopPreferences).toHaveBeenCalledWith(next);
  });

  it("migrates the legacy local storage value and clears it", async () => {
    const client = new DesktopPreferencesClient();
    const testWindow = window as unknown as {
      nileDesktop: {
        preferences: {
          migrateDesktopPreferences: ReturnType<typeof vi.fn>;
        };
      };
    };
    const storage = createStorage({
      "nile.desktop.preferences": "{\"language\":\"zh\"}",
    });

    const migrated = await client.migrateLegacy(storage);

    expect(testWindow.nileDesktop.preferences.migrateDesktopPreferences).toHaveBeenCalledWith("{\"language\":\"zh\"}");
    expect(storage.getItem("nile.desktop.preferences")).toBeNull();
    expect(migrated.language).toBe("zh");
  });

  it("subscribes through desktop preference change events", () => {
    const client = new DesktopPreferencesClient();
    const testWindow = window as unknown as {
      nileDesktopEvents: {
        onPreferencesChanged: ReturnType<typeof vi.fn>;
      };
    };
    const callback = vi.fn();
    const unsubscribe = client.subscribe(callback);

    expect(testWindow.nileDesktopEvents.onPreferencesChanged).toHaveBeenCalledWith(callback);
    expect(typeof unsubscribe).toBe("function");
  });
});

function createPreferences(): DesktopPreferences {
  return {
    agentOrder: ["codex", "claude", "cursor", "gemini", "openclaw"],
    credentialStorageMode: null,
    connectionQuotaMetricPreferences: {},
    language: "en",
    quickSetupDismissed: false,
    theme: "system",
  };
}

function createStorage(values: Record<string, string>): Storage {
  return {
    getItem(key: string) {
      return key in values ? values[key] : null;
    },
    setItem(key: string, value: string) {
      values[key] = value;
    },
    removeItem(key: string) {
      delete values[key];
    },
    clear() {
      for (const key of Object.keys(values)) {
        delete values[key];
      }
    },
    key(index: number) {
      return Object.keys(values)[index] ?? null;
    },
    get length() {
      return Object.keys(values).length;
    },
  };
}
