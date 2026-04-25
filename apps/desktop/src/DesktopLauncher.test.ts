import { describe, expect, it } from "vitest";

import { DesktopLauncher } from "../DesktopLauncher";

describe("DesktopLauncher", () => {
  it("rewrites the macOS host bundle metadata to Nile", () => {
    const infoPlist = [
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
      "<plist version=\"1.0\">",
      "<dict>",
      "  <key>CFBundleDisplayName</key>",
      "  <string>Electron</string>",
      "  <key>CFBundleIdentifier</key>",
      "  <string>com.github.electron</string>",
      "  <key>CFBundleName</key>",
      "  <string>Electron</string>",
      "</dict>",
      "</plist>",
    ].join("\n");

    const result = DesktopLauncher.rewriteInfoPlist(infoPlist);

    expect(result).toContain("<key>CFBundleDisplayName</key>\n  <string>Nile</string>");
    expect(result).toContain("<key>CFBundleName</key>\n  <string>Nile</string>");
    expect(result).toContain("<key>CFBundleIdentifier</key>\n  <string>com.nile.desktop.dev</string>");
    expect(result).not.toContain(">Electron</string>");
  });
});
