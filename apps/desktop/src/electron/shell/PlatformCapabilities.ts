export type DesktopPlatformCapabilities = {
  supportsTitleTicker: boolean;
  supportsTraySummary: boolean;
  supportsTrayPopup: boolean;
};

export function readDesktopPlatformCapabilities(
  platform: NodeJS.Platform = process.platform,
): DesktopPlatformCapabilities {
  return {
    supportsTitleTicker: platform === "darwin",
    supportsTraySummary: platform === "win32",
    supportsTrayPopup: platform === "win32",
  };
}
