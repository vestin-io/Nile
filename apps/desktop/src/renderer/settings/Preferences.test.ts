import { describe, expect, it } from "vitest";

import { SUPPORTED_AGENT_IDS } from "@nile/core/models/agent/definitions";

import { DesktopPreferencesStore } from "./Preferences";

describe("DesktopPreferencesStore", () => {
  it("keeps the default system theme when stored values are invalid", () => {
    const storage = createStorage({
      "nile.desktop.preferences": JSON.stringify({
        theme: "sepia",
      }),
    });
    const store = new DesktopPreferencesStore(storage, createRootElement());

    expect(store.load().theme).toBe("system");
  });

  it("includes every supported agent in the default order", () => {
    const store = new DesktopPreferencesStore(createStorage({}), createRootElement());

    expect(store.load().agentOrder).toEqual(SUPPORTED_AGENT_IDS);
  });

  it("appends newly supported agents to stored preferences", () => {
    const storage = createStorage({
      "nile.desktop.preferences": JSON.stringify({
        agentOrder: ["codex", "claude", "cursor", "openclaw"],
      }),
    });
    const store = new DesktopPreferencesStore(storage, createRootElement());

    expect(store.load().agentOrder).toEqual(["codex", "claude", "cursor", "openclaw", "gemini"]);
  });

  it("preserves normalized connection quota metric preferences", () => {
    const storage = createStorage({
      "nile.desktop.preferences": JSON.stringify({
        connectionQuotaMetricPreferences: {
          " codex-work ": " weekly ",
          "cursor-work": "",
        },
      }),
    });
    const store = new DesktopPreferencesStore(storage, createRootElement());

    expect(store.load().connectionQuotaMetricPreferences).toEqual({
      "codex-work": "weekly",
    });
  });
});

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

function createRootElement(): HTMLElement {
  return {
    classList: {
      toggle() {},
    },
    dataset: {},
    style: {
      colorScheme: "",
    },
  } as unknown as HTMLElement;
}
