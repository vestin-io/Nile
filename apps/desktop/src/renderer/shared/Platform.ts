import type { Translator } from "./I18n";

export type DesktopPlatform = "darwin" | "win32" | "linux" | "unknown";

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
