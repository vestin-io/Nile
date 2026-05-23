import { useCallback, useEffect, useRef, useState } from "react";

type CredentialStorageState = Awaited<ReturnType<typeof window.nileDesktop.connections.getCredentialStorageState>>;

type PendingUnlock = {
  promise: Promise<void>;
  resolve(): void;
  reject(error: Error): void;
};

type UseCredentialStorageSessionOptions = {
  onActionError(message: string | null): void;
};

type CredentialStorageSessionState = {
  credentialStorageState: CredentialStorageState;
  isUnlockEncryptedLocalStorageDialogOpen: boolean;
  isUnlockingEncryptedLocalStorage: boolean;
  refreshCredentialStorageState(): Promise<CredentialStorageState>;
  requestEncryptedLocalUnlock(): Promise<void>;
  setUnlockEncryptedLocalStorageDialogOpen(open: boolean): void;
  unlockEncryptedLocalStorage(passphrase: string): Promise<void>;
  unlockEncryptedLocalStorageError: string | null;
};

export function useCredentialStorageSession({
  onActionError,
}: UseCredentialStorageSessionOptions): CredentialStorageSessionState {
  const pendingEncryptedLocalUnlockRef = useRef<PendingUnlock | null>(null);
  const startupEncryptedLocalUnlockCheckedRef = useRef(false);
  const [credentialStorageStateLoaded, setCredentialStorageStateLoaded] = useState(false);
  const [credentialStorageState, setCredentialStorageState] = useState<CredentialStorageState>({
    encryptedLocalVaultExists: false,
    encryptedLocalUnlocked: false,
  });
  const [isUnlockEncryptedLocalStorageDialogOpen, setUnlockEncryptedLocalStorageDialogOpen] = useState(false);
  const [unlockEncryptedLocalStorageError, setUnlockEncryptedLocalStorageError] = useState<string | null>(null);
  const [isUnlockingEncryptedLocalStorage, setIsUnlockingEncryptedLocalStorage] = useState(false);

  const requestEncryptedLocalUnlock = useCallback(async (): Promise<void> => {
    onActionError(null);
    const existing = pendingEncryptedLocalUnlockRef.current;
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
    setCredentialStorageStateLoaded(true);
    return nextState;
  }, []);

  const closeEncryptedLocalUnlockDialog = useCallback((error: Error | null = null) => {
    const pending = pendingEncryptedLocalUnlockRef.current;
    pendingEncryptedLocalUnlockRef.current = null;
    setUnlockEncryptedLocalStorageDialogOpen(false);
    setUnlockEncryptedLocalStorageError(null);
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
      await window.nileDesktop.connections.unlockEncryptedLocalStorage(passphrase);
      await refreshCredentialStorageState();
      closeEncryptedLocalUnlockDialog();
    } catch (error) {
      setUnlockEncryptedLocalStorageError(error instanceof Error ? error.message : String(error));
      setIsUnlockingEncryptedLocalStorage(false);
    }
  }, [closeEncryptedLocalUnlockDialog, refreshCredentialStorageState]);

  useEffect(() => {
    void refreshCredentialStorageState().catch(() => undefined);
  }, [refreshCredentialStorageState]);

  useEffect(() => window.nileDesktopEvents.onLocalStateReset(() => {
    setCredentialStorageState({
      encryptedLocalVaultExists: false,
      encryptedLocalUnlocked: false,
    });
    setCredentialStorageStateLoaded(true);
  }), []);

  useEffect(() => {
    if (!credentialStorageStateLoaded || startupEncryptedLocalUnlockCheckedRef.current) {
      return;
    }
    startupEncryptedLocalUnlockCheckedRef.current = true;
    if (credentialStorageState.encryptedLocalVaultExists && !credentialStorageState.encryptedLocalUnlocked) {
      void window.nileDesktop.app.openSettings().catch(() => undefined).then(() => (
        requestEncryptedLocalUnlock().catch(() => undefined)
      ));
    }
  }, [credentialStorageState, credentialStorageStateLoaded, requestEncryptedLocalUnlock]);

  return {
    credentialStorageState,
    isUnlockEncryptedLocalStorageDialogOpen,
    isUnlockingEncryptedLocalStorage,
    refreshCredentialStorageState,
    requestEncryptedLocalUnlock,
    setUnlockEncryptedLocalStorageDialogOpen: setUnlockDialogOpen,
    unlockEncryptedLocalStorage,
    unlockEncryptedLocalStorageError,
  };
}
