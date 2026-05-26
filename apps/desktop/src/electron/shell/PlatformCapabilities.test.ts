import { describe, expect, it } from "vitest";

import { readDesktopPlatformCapabilities } from "./PlatformCapabilities";

describe("readDesktopPlatformCapabilities", () => {
  it("enables title ticker support only on macOS and tray summary/popup only on Windows", () => {
    expect(readDesktopPlatformCapabilities("darwin")).toEqual({
      supportsTitleTicker: true,
      supportsTraySummary: false,
      supportsTrayPopup: false,
    });
    expect(readDesktopPlatformCapabilities("win32")).toEqual({
      supportsTitleTicker: false,
      supportsTraySummary: true,
      supportsTrayPopup: true,
    });
  });

  it("does not enable title ticker, tray summary, or tray popup on unsupported desktop platforms", () => {
    expect(readDesktopPlatformCapabilities("linux")).toEqual({
      supportsTitleTicker: false,
      supportsTraySummary: false,
      supportsTrayPopup: false,
    });
  });
});
