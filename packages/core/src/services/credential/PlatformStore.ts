import { BackendCredentialStore } from "./BackendCredentialStore";
import type { CredentialStore } from "./Store";
import { KeychainCredentialStore } from "./KeychainCredentialStore";
import { WindowsCredentialManagerStore } from "./WindowsCredentialManagerStore";

export function createPlatformCredentialStore(
  platform: NodeJS.Platform = process.platform,
): CredentialStore {
  if (platform === "win32") {
    return new WindowsCredentialManagerStore();
  }

  return new KeychainCredentialStore();
}

export function createPlatformWorkspaceCredentialStore(
  databasePath: string,
  platform: NodeJS.Platform = process.platform,
): CredentialStore {
  return new BackendCredentialStore(databasePath, createPlatformCredentialStore(platform));
}
