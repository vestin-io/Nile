import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { GeminiSettingsStore } from "./SettingsStore";

const tempDirs: string[] = [];

describe("GeminiSettingsStore", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
  });

  it("reads selectedType from settings.json", () => {
    const store = new GeminiSettingsStore(createGeminiHome());

    store.restore(JSON.stringify({
      security: {
        auth: {
          selectedType: "oauth-personal",
        },
      },
    }));

    expect(store.readSelectedAuthType()).toBe("oauth-personal");
  });

  it("writes oauth-personal without discarding unrelated settings", () => {
    const store = new GeminiSettingsStore(createGeminiHome());

    store.restore(JSON.stringify({
      mcpServers: {
        test: {},
      },
      security: {
        auth: {
          selectedType: "gemini-api-key",
        },
      },
      ui: {
        theme: "Default Light",
      },
    }));

    store.ensureOauthPersonal();

    expect(JSON.parse(readFileSync(store.settingsPath, "utf8"))).toEqual({
      mcpServers: {
        test: {},
      },
      security: {
        auth: {
          selectedType: "oauth-personal",
        },
      },
      ui: {
        theme: "Default Light",
      },
    });
  });

  it("writes model.name without discarding unrelated settings", () => {
    const store = new GeminiSettingsStore(createGeminiHome());

    store.restore(JSON.stringify({
      security: {
        auth: {
          selectedType: "oauth-personal",
        },
      },
      ui: {
        theme: "Default Light",
      },
    }));

    store.applyModelName("gemini-3-flash-preview");

    expect(store.readModelName()).toBe("gemini-3-flash-preview");
    expect(JSON.parse(readFileSync(store.settingsPath, "utf8"))).toEqual({
      security: {
        auth: {
          selectedType: "oauth-personal",
        },
      },
      model: {
        name: "gemini-3-flash-preview",
      },
      ui: {
        theme: "Default Light",
      },
    });
  });
});

function createGeminiHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-gemini-settings-store-"));
  tempDirs.push(dir);
  return join(dir, ".gemini");
}
