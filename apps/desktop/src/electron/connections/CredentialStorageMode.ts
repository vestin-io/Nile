import type { NileSession } from "@nile/builtins/runtime";
import type { CredentialStorageBackend } from "@nile/core/services/credential";

const SUPPORTED_MACHINE_STORAGE_MODES: CredentialStorageBackend[] = [
  "system_secure_storage",
  "encrypted_local_storage",
];

export class DesktopCredentialStorageModeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DesktopCredentialStorageModeError";
  }
}

export function resolveDesktopCredentialStorageMode(
  session: NileSession,
  requestedMode: CredentialStorageBackend | undefined,
): CredentialStorageBackend {
  const savedModes = [...new Set(session
    .listSavedConnections()
    .map((connection) => connection.credentialStorageBackend)
    .filter((backend): backend is CredentialStorageBackend =>
      backend !== undefined && SUPPORTED_MACHINE_STORAGE_MODES.includes(backend),
    ))];

  if (savedModes.length > 1) {
    throw new DesktopCredentialStorageModeError(
      "Saved connections use multiple credential storage modes. Reset local state before saving more connections.",
    );
  }

  const establishedMode = savedModes[0];
  if (establishedMode) {
    return establishedMode;
  }

  if (!requestedMode) {
    throw new DesktopCredentialStorageModeError(
      "Credential storage mode has not been established yet. Choose a storage mode before saving the first connection.",
    );
  }

  return requestedMode;
}
