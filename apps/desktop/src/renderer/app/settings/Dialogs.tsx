import type { ReusedConnectionDialogState } from "./useNavigation";
import { CursorUsageRepairDialog } from "../../connections/dialogs/RepairUsage";
import { UnlockEncryptedLocalStorageDialog } from "../../connections/dialogs/UnlockEncryptedLocalStorage";
import { ResetStateDialog } from "../../settings/dialogs/ResetState";
import { ReusedConnectionDialog } from "../../connections/dialogs/Reused";
import { NileDialog } from "../../settings/dialogs/Nile";
import type { DesktopConnection } from "../../../state/Types";
import type { Translator } from "../../shared/I18n";

type SettingsDialogsProps = {
  isResetting: boolean;
  isSupportOpen: boolean;
  isResetDialogOpen: boolean;
  isUnlockingEncryptedLocalStorage: boolean;
  isUnlockEncryptedLocalStorageDialogOpen: boolean;
  unlockEncryptedLocalStorageHint: string | null;
  repairUsageConnection: DesktopConnection | null;
  reusedConnectionDialog: ReusedConnectionDialogState;
  t: Translator;
  unlockEncryptedLocalStorageError: string | null;
  onBindCursorUsage(connectionId: string, sessionToken: string): Promise<void>;
  onCloseRepairUsage(): void;
  onOpenGitHubIssues(): Promise<void>;
  onOpenSupport(): Promise<void>;
  onRefresh(): Promise<void>;
  onResetConfirm(): Promise<void>;
  onContinueReusedConnection(): void;
  onSetNileDialogOpen(open: boolean): void;
  onSetResetDialogOpen(open: boolean): void;
  onSetUnlockEncryptedLocalStorageDialogOpen(open: boolean): void;
  onUnlockEncryptedLocalStorage(passphrase: string): Promise<void>;
};

export function SettingsDialogs({
  isResetting,
  isSupportOpen,
  isResetDialogOpen,
  isUnlockingEncryptedLocalStorage,
  isUnlockEncryptedLocalStorageDialogOpen,
  unlockEncryptedLocalStorageHint,
  repairUsageConnection,
  reusedConnectionDialog,
  t,
  unlockEncryptedLocalStorageError,
  onBindCursorUsage,
  onCloseRepairUsage,
  onOpenGitHubIssues,
  onOpenSupport,
  onRefresh,
  onResetConfirm,
  onContinueReusedConnection,
  onSetNileDialogOpen,
  onSetResetDialogOpen,
  onSetUnlockEncryptedLocalStorageDialogOpen,
  onUnlockEncryptedLocalStorage,
}: SettingsDialogsProps) {
  return (
    <>
      <CursorUsageRepairDialog
        connection={repairUsageConnection}
        open={repairUsageConnection !== null}
        t={t}
        onOpenChange={(open) => {
          if (!open) {
            onCloseRepairUsage();
          }
        }}
        onSubmit={async (connectionId, sessionToken) => {
          await onBindCursorUsage(connectionId, sessionToken);
          await onRefresh();
        }}
      />

      <ResetStateDialog
        isResetting={isResetting}
        open={isResetDialogOpen}
        t={t}
        onOpenChange={onSetResetDialogOpen}
        onConfirm={onResetConfirm}
      />

      <ReusedConnectionDialog
        open={reusedConnectionDialog !== null}
        t={t}
        onContinue={onContinueReusedConnection}
      />

      <UnlockEncryptedLocalStorageDialog
        errorMessage={unlockEncryptedLocalStorageError}
        hintMessage={unlockEncryptedLocalStorageHint}
        isSubmitting={isUnlockingEncryptedLocalStorage}
        open={isUnlockEncryptedLocalStorageDialogOpen}
        t={t}
        onOpenChange={onSetUnlockEncryptedLocalStorageDialogOpen}
        onSubmit={onUnlockEncryptedLocalStorage}
      />

      <NileDialog
        open={isSupportOpen}
        t={t}
        onOpenChange={onSetNileDialogOpen}
        onOpenGitHubIssues={onOpenGitHubIssues}
        onOpenSupport={onOpenSupport}
      />
    </>
  );
}
