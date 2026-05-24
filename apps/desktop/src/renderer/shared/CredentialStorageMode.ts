import type { CredentialStorageBackend } from "@nile/core/services/credential";

export type CredentialStorageModeState = {
  mode: CredentialStorageBackend | null;
  isLocked: boolean;
  isMixed: boolean;
};

export function readCredentialStorageModeState(
  preference: CredentialStorageBackend | null,
  savedMode: CredentialStorageBackend | null,
  hasSavedConnections: boolean,
  isMixed: boolean,
): CredentialStorageModeState {
  if (isMixed) {
    return {
      mode: null,
      isLocked: true,
      isMixed: true,
    };
  }

  if (savedMode !== null) {
    return {
      mode: savedMode,
      isLocked: true,
      isMixed: false,
    };
  }

  if (preference !== null) {
    return {
      mode: preference,
      isLocked: true,
      isMixed: false,
    };
  }

  if (hasSavedConnections) {
    return {
      mode: null,
      isLocked: true,
      isMixed: false,
    };
  }

  return {
    mode: null,
    isLocked: false,
    isMixed: false,
  };
}
