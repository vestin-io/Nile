import { SecureSnapshotStore } from "./SecureSnapshotStore";
import { WindowsSecureSnapshotStore } from "./WindowsSecureSnapshotStore";

export function createPlatformSecureSnapshotStore(
  platform: NodeJS.Platform = process.platform,
): SecureSnapshotStore {
  if (platform === "win32") {
    return new WindowsSecureSnapshotStore();
  }

  return new SecureSnapshotStore();
}
