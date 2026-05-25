import type { Translator } from "./I18n";

export type DesktopPlatform = "darwin" | "win32" | "linux" | "unknown";
export type DesktopStatusEntrySettings = {
  title: string;
  description: string;
  label: string;
  appEntryLabel: string;
  summaryLabel: string;
};

export function detectDesktopPlatform(userAgent: string = navigator.userAgent): DesktopPlatform {
  if (/Windows/i.test(userAgent)) {
    return "win32";
  }
  if (/Macintosh|Mac OS X/i.test(userAgent)) {
    return "darwin";
  }
  if (/Linux/i.test(userAgent)) {
    return "linux";
  }
  return "unknown";
}

export function readDocumentPlatform(userAgent: string = navigator.userAgent): "mac" | "windows" | "other" {
  const platform = detectDesktopPlatform(userAgent);
  if (platform === "darwin") {
    return "mac";
  }
  if (platform === "win32") {
    return "windows";
  }
  return "other";
}

export function readSystemSecureStorageName(
  t: Translator,
  platform: DesktopPlatform = detectDesktopPlatform(),
): string {
  if (platform === "darwin") {
    return t("systemSecureStorage.name.appleKeychain");
  }
  if (platform === "win32") {
    return t("systemSecureStorage.name.windowsCredentialManager");
  }
  return t("systemSecureStorage.name.systemPasswordManager");
}

export function readStatusEntrySettings(
  t: Translator,
  platform: DesktopPlatform = detectDesktopPlatform(),
): DesktopStatusEntrySettings | null {
  const surface = readStatusEntrySurfaceName(t, platform);
  if (!surface) {
    return null;
  }

  return {
    title: t("settings.statusEntry.title", { surface }),
    description: t("settings.statusEntry.description", { surface }),
    label: t("settings.statusEntry.label", { surface }),
    appEntryLabel: t("settings.statusEntry.mode.appEntry"),
    summaryLabel: readStatusEntrySummaryLabel(t, platform),
  };
}

export function readStatusEntrySummaryLabel(
  t: Translator,
  platform: DesktopPlatform = detectDesktopPlatform(),
): string {
  if (platform === "win32") {
    return t("settings.statusEntry.mode.usageSummary");
  }
  return t("settings.statusEntry.mode.ticker");
}

export function readStatusEntryToggleLabel(
  t: Translator,
  platform: DesktopPlatform = detectDesktopPlatform(),
): string {
  if (platform === "win32") {
    return t("tray.showInUsageSummary");
  }
  return t("tray.showInTicker");
}

function readStatusEntrySurfaceName(
  t: Translator,
  platform: DesktopPlatform,
): string | null {
  if (platform === "darwin") {
    return t("settings.statusEntry.surface.menuBar");
  }
  if (platform === "win32") {
    return t("settings.statusEntry.surface.tray");
  }
  return null;
}
