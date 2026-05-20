import { describe, expect, it } from "vitest";
import type { execFileSync } from "node:child_process";
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

  it("prepares the macOS host when Electron is hoisted to the workspace root", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "nile-desktop-launcher-"));
    const appRoot = join(repoRoot, "apps", "desktop");
    try {
      const electronAppRoot = join(
        repoRoot,
        "node_modules",
        "electron",
        "dist",
        "Electron.app",
        "Contents",
      );
      mkdirSync(join(appRoot, "build", "icons"), { recursive: true });
      mkdirSync(join(electronAppRoot, "MacOS"), { recursive: true });
      mkdirSync(join(electronAppRoot, "Resources"), { recursive: true });
      mkdirSync(join(repoRoot, "node_modules", "electron"), { recursive: true });
      writeFileSync(join(appRoot, "package.json"), "{}");
      writeFileSync(join(appRoot, "build", "icons", "icon.icns"), "nile-icon");
      writeFileSync(join(repoRoot, "node_modules", "electron", "package.json"), "{}");
      writeFileSync(join(electronAppRoot, "MacOS", "Electron"), "");
      writeFileSync(join(electronAppRoot, "Resources", "electron.icns"), "electron-icon");
      writeFileSync(
        join(electronAppRoot, "Info.plist"),
        [
          "<plist>",
          "<dict>",
          "<key>CFBundleDisplayName</key><string>Electron</string>",
          "<key>CFBundleIdentifier</key><string>com.github.electron</string>",
          "<key>CFBundleName</key><string>Electron</string>",
          "</dict>",
          "</plist>",
        ].join("\n"),
      );

      const launcher = new DesktopLauncher(appRoot);
      const prepareMacHost = (
        Reflect.get(launcher, "prepareMacHost") as () => string
      ).bind(launcher);
      const executablePath = prepareMacHost();
      const targetRoot = join(appRoot, ".runtime", "host", "Nile.app", "Contents");

      expect(executablePath).toBe(join(targetRoot, "MacOS", "Electron"));
      expect(readFileSync(join(targetRoot, "Resources", "electron.icns"), "utf8")).toBe("nile-icon");
      expect(readFileSync(join(targetRoot, "Info.plist"), "utf8")).toContain(
        "<key>CFBundleName</key><string>Nile</string>",
      );
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("reinstalls the Electron runtime when the macOS host bundle is missing", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "nile-desktop-launcher-"));
    const appRoot = join(repoRoot, "apps", "desktop");
    try {
      const electronRoot = join(repoRoot, "node_modules", "electron");
      const electronAppRoot = join(
        electronRoot,
        "dist",
        "Electron.app",
        "Contents",
      );
      mkdirSync(join(appRoot, "build", "icons"), { recursive: true });
      mkdirSync(electronRoot, { recursive: true });
      writeFileSync(join(appRoot, "package.json"), "{}");
      writeFileSync(join(appRoot, "build", "icons", "icon.icns"), "nile-icon");
      writeFileSync(join(electronRoot, "package.json"), "{}");
      writeFileSync(join(electronRoot, "install.js"), "");

      let installCalled = false;
      const runCommand = ((...input: Parameters<typeof execFileSync>) => {
        const [, args] = input;
        installCalled = true;
        expect(args).toBeDefined();
        if (!args) {
          throw new Error("Expected install script args");
        }
        expect(args).toHaveLength(1);
        expect(args[0]?.endsWith("/node_modules/electron/install.js")).toBe(true);
        mkdirSync(join(electronAppRoot, "MacOS"), { recursive: true });
        mkdirSync(join(electronAppRoot, "Resources"), { recursive: true });
        writeFileSync(join(electronAppRoot, "MacOS", "Electron"), "");
        writeFileSync(join(electronAppRoot, "Resources", "electron.icns"), "electron-icon");
        writeFileSync(
          join(electronAppRoot, "Info.plist"),
          [
            "<plist>",
            "<dict>",
            "<key>CFBundleDisplayName</key><string>Electron</string>",
            "<key>CFBundleIdentifier</key><string>com.github.electron</string>",
            "<key>CFBundleName</key><string>Electron</string>",
            "</dict>",
            "</plist>",
          ].join("\n"),
        );
        return Buffer.alloc(0);
      }) as typeof execFileSync;
      const launcher = new DesktopLauncher(appRoot, runCommand);

      const prepareMacHost = (
        Reflect.get(launcher, "prepareMacHost") as () => string
      ).bind(launcher);
      const executablePath = prepareMacHost();

      expect(installCalled).toBe(true);
      expect(executablePath).toBe(join(appRoot, ".runtime", "host", "Nile.app", "Contents", "MacOS", "Electron"));
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
