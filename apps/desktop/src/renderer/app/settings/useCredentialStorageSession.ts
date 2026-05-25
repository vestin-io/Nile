import { useCallback, useEffect, useRef, useState } from "react";

import { readEncryptedLocalUnlockErrorMessage } from "../../shared/EncryptedLocalUnlock";

type CredentialStorageState = Awaited<ReturnType<typeof window.nileDesktop.connections.getCredentialStorageState>>;

type PendingUnlock = {
  promise: Promise<void>;
  resolve(): void;
  reject(error: Error): void;
};

type UseCredentialStorageSessionOptions = {
  onActionError(message: string | null): void;
  onUnlocked?(): Promise<void>;
  t: (key: string) => string;
};

type CredentialStorageSessionState = {
  credentialStorageState: CredentialStorageState;
  unlockEncryptedLocalStorageHint: string | null;
  isUnlockEncryptedLocalStorageDialogOpen: boolean;
  isUnlockingEncryptedLocalStorage: boolean;
  refreshCredentialStorageState(): Promise<CredentialStorageState>;
  requestEncryptedLocalUnlock(hint?: string): Promise<void>;
  setUnlockEncryptedLocalStorageDialogOpen(open: boolean): void;
  unlockEncryptedLocalStorage(passphrase: string): Promise<void>;
  unlockEncryptedLocalStorageError: string | null;
};

export function useCredentialStorageSession({
  onActionError,
  onUnlocked,
  t,
}: UseCredentialStorageSessionOptions): CredentialStorageSessionState {
  const pendingEncryptedLocalUnlockRef = useRef<PendingUnlock | null>(null);
  const [credentialStorageState, setCredentialStorageState] = useState<CredentialStorageState>({
    encryptedLocalVaultExists: false,
    encryptedLocalUnlocked: false,
  });
  const [unlockEncryptedLocalStorageHint, setUnlockEncryptedLocalStorageHint] = useState<string | null>(null);
  const [isUnlockEncryptedLocalStorageDialogOpen, setUnlockEncryptedLocalStorageDialogOpen] = useState(false);
  const [unlockEncryptedLocalStorageError, setUnlockEncryptedLocalStorageError] = useState<string | null>(null);
  const [isUnlockingEncryptedLocalStorage, setIsUnlockingEncryptedLocalStorage] = useState(false);

  const requestEncryptedLocalUnlock = useCallback(async (hint?: string): Promise<void> => {
    onActionError(null);
    const existing = pendingEncryptedLocalUnlockRef.current;
    setUnlockEncryptedLocalStorageHint(hint ?? null);
    if (existing) {
      return await existing.promise;
    }
    setUnlockEncryptedLocalStorageError(null);
    setUnlockEncryptedLocalStorageDialogOpen(true);
    let resolvePromise!: () => void;
    let rejectPromise!: (error: Error) => void;
    const promise = new Promise<void>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = (error: Error) => reject(error);
    });
    pendingEncryptedLocalUnlockRef.current = {
      promise,
      resolve: resolvePromise,
      reject: rejectPromise,
    };
    return await promise;
  }, [onActionError]);

  const refreshCredentialStorageState = useCallback(async (): Promise<CredentialStorageState> => {
    const nextState = await window.nileDesktop.connections.getCredentialStorageState();
    setCredentialStorageState(nextState);
    return nextState;
  }, []);

  const closeEncryptedLocalUnlockDialog = useCallback((error: Error | null = null) => {
    const pending = pendingEncryptedLocalUnlockRef.current;
    pendingEncryptedLocalUnlockRef.current = null;
    setUnlockEncryptedLocalStorageDialogOpen(false);
    setUnlockEncryptedLocalStorageError(null);
    setUnlockEncryptedLocalStorageHint(null);
    setIsUnlockingEncryptedLocalStorage(false);
    if (!pending) {
      return;
    }
    if (error) {
      pending.reject(error);
      return;
    }
    pending.resolve();
  }, []);

  const setUnlockDialogOpen = useCallback((open: boolean) => {
    if (open) {
      setUnlockEncryptedLocalStorageDialogOpen(true);
      return;
    }
    closeEncryptedLocalUnlockDialog(new Error("Encrypted local storage remains locked."));
  }, [closeEncryptedLocalUnlockDialog]);

  const unlockEncryptedLocalStorage = useCallback(async (passphrase: string) => {
    setIsUnlockingEncryptedLocalStorage(true);
    setUnlockEncryptedLocalStorageError(null);
    try {
      const result = await window.nileDesktop.connections.unlockEncryptedLocalStorage(passphrase);
      if (!result.ok) {
        setUnlockEncryptedLocalStorageError(readEncryptedLocalUnlockErrorMessage(result, t));
        setIsUnlockingEncryptedLocalStorage(false);
        return;
      }
      await refreshCredentialStorageState();
      closeEncryptedLocalUnlockDialog();
      void onUnlocked?.().catch(() => undefined);
    } catch {
      setUnlockEncryptedLocalStorageError(t("dialog.encryptedLocalUnlock.errorUnknown"));
      setIsUnlockingEncryptedLocalStorage(false);
    }
  }, [closeEncryptedLocalUnlockDialog, onUnlocked, refreshCredentialStorageState, t]);

  useEffect(() => {
    void refreshCredentialStorageState().catch(() => undefined);
  }, [refreshCredentialStorageState]);

  useEffect(() => window.nileDesktopEvents.onLocalStateReset(() => {
    setCredentialStorageState({
      encryptedLocalVaultExists: false,
      encryptedLocalUnlocked: false,
    });
    setUnlockEncryptedLocalStorageHint(null);
  }), []);

  return {
    credentialStorageState,
    unlockEncryptedLocalStorageHint,
    isUnlockEncryptedLocalStorageDialogOpen,
    isUnlockingEncryptedLocalStorage,
    refreshCredentialStorageState,
    requestEncryptedLocalUnlock,
    setUnlockEncryptedLocalStorageDialogOpen: setUnlockDialogOpen,
    unlockEncryptedLocalStorage,
    unlockEncryptedLocalStorageError,
  };
}
