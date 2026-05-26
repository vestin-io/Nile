import { describe, expect, it } from "vitest";

import {
  detectDesktopPlatform,
  readDocumentPlatform,
  readStatusEntrySettings,
  readStatusEntryToggleLabel,
  readSystemSecureStorageName,
} from "./Platform";

describe("Platform", () => {
  it("detects macOS and Windows user agents", () => {
    expect(detectDesktopPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("darwin");
    expect(detectDesktopPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("win32");
  });

  it("maps document dataset platform values", () => {
    expect(readDocumentPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("mac");
    expect(readDocumentPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
    expect(readDocumentPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("other");
  });

  it("returns the system secure storage name for each platform", () => {
    const t = (key: string) => key;

    expect(readSystemSecureStorageName(t, "darwin")).toBe("systemSecureStorage.name.appleKeychain");
    expect(readSystemSecureStorageName(t, "win32")).toBe("systemSecureStorage.name.windowsCredentialManager");
    expect(readSystemSecureStorageName(t, "linux")).toBe("systemSecureStorage.name.systemPasswordManager");
  });

  it("returns platform-specific status entry settings copy", () => {
    const templates: Record<string, string> = {
      "settings.statusEntry.title": "{surface}",
      "settings.statusEntry.description": "Show status in {surface}",
      "settings.statusEntry.label": "{surface} display",
      "settings.statusEntry.mode.appEntry": "App entry",
      "settings.statusEntry.mode.ticker": "Ticker",
      "settings.statusEntry.mode.usageSummary": "Usage summary",
      "settings.statusEntry.surface.menuBar": "Menu bar",
      "settings.statusEntry.surface.tray": "Tray",
    };
    const t = (key: string, variables?: Record<string, string | number>) => {
      const template = templates[key] ?? key;
      if (!variables) {
        return template;
      }
      return Object.entries(variables).reduce(
        (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
        template,
      );
    };

    expect(readStatusEntrySettings(t, "darwin")).toEqual({
      title: "Menu bar",
      description: "Show status in Menu bar",
      label: "Menu bar display",
      appEntryLabel: "App entry",
      summaryLabel: "Ticker",
    });
    expect(readStatusEntrySettings(t, "win32")).toEqual({
      title: "Tray",
      description: "Show status in Tray",
      label: "Tray display",
      appEntryLabel: "App entry",
      summaryLabel: "Usage summary",
    });
    expect(readStatusEntrySettings(t, "linux")).toBeNull();
  });

  it("returns platform-specific status entry toggle labels", () => {
    const t = (key: string) => key;

    expect(readStatusEntryToggleLabel(t, "darwin")).toBe("tray.showInTicker");
    expect(readStatusEntryToggleLabel(t, "win32")).toBe("tray.showInUsageSummary");
  });
});
