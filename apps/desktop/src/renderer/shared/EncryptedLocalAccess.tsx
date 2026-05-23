import * as React from "react";

type EncryptedLocalAccessContextValue = {
  recover<T>(operation: () => Promise<T>): Promise<T>;
};

const EncryptedLocalAccessContext = React.createContext<EncryptedLocalAccessContextValue | null>(null);

type EncryptedLocalAccessProviderProps = React.PropsWithChildren<{
  requestUnlock(): Promise<void>;
}>;

export function EncryptedLocalAccessProvider({
  children,
  requestUnlock,
}: EncryptedLocalAccessProviderProps) {
  const value = React.useMemo<EncryptedLocalAccessContextValue>(
    () => ({
      recover: async <T,>(operation: () => Promise<T>) =>
        await runWithEncryptedLocalUnlockRetry(operation, requestUnlock),
    }),
    [requestUnlock],
  );

  return (
    <EncryptedLocalAccessContext.Provider value={value}>
      {children}
    </EncryptedLocalAccessContext.Provider>
  );
}

export function useEncryptedLocalAccessRecovery() {
  const context = React.useContext(EncryptedLocalAccessContext);
  if (!context) {
    throw new Error("useEncryptedLocalAccessRecovery must be used within EncryptedLocalAccessProvider");
  }
  return context;
}

export async function runWithEncryptedLocalUnlockRetry<T>(
  operation: () => Promise<T>,
  requestUnlock: () => Promise<void>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isEncryptedLocalLockedErrorMessage(readErrorMessage(error))) {
      throw error;
    }
    await requestUnlock();
    return await operation();
  }
}

export function isEncryptedLocalLockedErrorMessage(message: string): boolean {
  return message.toLowerCase().includes("encrypted local storage is locked");
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.replace(/^Error invoking remote method '[^']+':\s*/, "");
  }
  return String(error);
}
