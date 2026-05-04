import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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

  it("replaces the dev host icon with the Nile app icon", () => {
    const root = mkdtempSync(join(tmpdir(), "nile-desktop-launcher-"));
    try {
      const iconDir = join(root, "build", "icons");
      const targetDir = join(root, ".runtime", "host", "Nile.app", "Contents", "Resources");
      mkdirSync(iconDir, { recursive: true });
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(join(iconDir, "icon.icns"), "nile-icon");
      writeFileSync(join(targetDir, "electron.icns"), "electron-icon");

      const launcher = new DesktopLauncher(root);
      const copyMacHostIcon = (
        Reflect.get(launcher, "copyMacHostIcon") as (targetIconPath: string) => void
      ).bind(launcher);
      copyMacHostIcon(join(targetDir, "electron.icns"));

      expect(readFileSync(join(targetDir, "electron.icns"), "utf8")).toBe("nile-icon");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
