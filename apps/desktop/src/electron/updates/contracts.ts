export type DesktopUpdateBridge = {
  getReleaseInfo(): Promise<import("../../state/Types").DesktopReleaseInfo>;
  checkForUpdates(): Promise<import("../../state/Types").DesktopUpdateCheckResult>;
  installUpdate(): Promise<import("../../state/Types").DesktopInstallUpdateResult>;
};
