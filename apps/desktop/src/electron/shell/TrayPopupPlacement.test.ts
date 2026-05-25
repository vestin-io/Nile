import { describe, expect, it } from "vitest";

import { TrayPopupPlacement } from "./TrayPopupPlacement";

describe("TrayPopupPlacement", () => {
  it("places a bottom taskbar popup above the tray icon", () => {
    expect(TrayPopupPlacement.readPosition({
      popupHeight: 420,
      popupWidth: 360,
      trayBounds: { x: 1400, y: 1040, width: 32, height: 32 },
      workArea: { x: 0, y: 0, width: 1440, height: 1040 },
    })).toEqual({
      x: 1068,
      y: 608,
    });
  });

  it("places a top taskbar popup below the tray icon", () => {
    expect(TrayPopupPlacement.readPosition({
      popupHeight: 420,
      popupWidth: 360,
      trayBounds: { x: 1200, y: 0, width: 32, height: 32 },
      workArea: { x: 0, y: 40, width: 1440, height: 1000 },
    })).toEqual({
      x: 1036,
      y: 52,
    });
  });

  it("places a left taskbar popup to the right of the tray icon", () => {
    expect(TrayPopupPlacement.readPosition({
      popupHeight: 420,
      popupWidth: 360,
      trayBounds: { x: 0, y: 800, width: 40, height: 40 },
      workArea: { x: 48, y: 0, width: 1392, height: 1040 },
    })).toEqual({
      x: 60,
      y: 608,
    });
  });

  it("clamps a right taskbar popup into the visible work area", () => {
    expect(TrayPopupPlacement.readPosition({
      popupHeight: 420,
      popupWidth: 360,
      trayBounds: { x: 1410, y: 1010, width: 30, height: 30 },
      workArea: { x: 0, y: 0, width: 1400, height: 1040 },
    })).toEqual({
      x: 1028,
      y: 578,
    });
  });
});
