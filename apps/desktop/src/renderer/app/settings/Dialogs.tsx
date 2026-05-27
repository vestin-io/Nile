import type { ReusedConnectionDialogState } from "./useNavigation";
import { CursorUsageRepairDialog } from "../../connections/dialogs/RepairUsage";
import { UnlockEncryptedLocalStorageDialog } from "../../connections/dialogs/UnlockEncryptedLocalStorage";
import { ResetStateDialog } from "../../settings/dialogs/ResetState";
import { ReusedConnectionDialog } from "../../connections/dialogs/Reused";
import { NileDialog } from "../../settings/dialogs/Nile";
import { CredentialExportDialog } from "../../settings/dialogs/CredentialExport";
import { CredentialImportDialog } from "../../settings/dialogs/CredentialImport";
import { CredentialImportResultDialog } from "../../settings/dialogs/CredentialImportResult";
import type { DesktopConnection } from "../../../state/Types";
import type { Translator } from "../../shared/I18n";
import type { CredentialStorageBackend, PortableImportConflictStrategy } from "@nile/core/services/credential";
import type { DesktopCredentialImportPreview, DesktopCredentialStorageState } from "../../../electron/connections/contracts";

type SettingsDialogsProps = {
  isResetting: boolean;
  isSupportOpen: boolean;
  isResetDialogOpen: boolean;
  isExportDialogOpen: boolean;
  isExportingCredentials: boolean;
  exportConnectionCount: number;
  exportError: string | null;
  exportFilePath: string;
  exportPassphrase: string;
  exportPassphraseConfirmation: string;
  isImportDialogOpen: boolean;
  isPreviewingCredentialImport: boolean;
  isApplyingCredentialImport: boolean;
  importError: string | null;
  importFilePath: string;
  importExportPassphrase: string;
  importPreview: DesktopCredentialImportPreview | null;
  selectedImportStableKeys: string[];
  importStrategy: PortableImportConflictStrategy;
  importTargetStorageMode: CredentialStorageBackend;
  importEncryptedLocalPassphrase: string;
  importEncryptedLocalPassphraseConfirmation: string;
  credentialStorageState: DesktopCredentialStorageState;
  isImportResultDialogOpen: boolean;
  importResult:
    | {
        importedConnectionIds: string[];
        replacedConnectionIds: string[];
        skippedStableKeys: string[];
        targetStorageMode: CredentialStorageBackend;
      }
    | null;
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
  onSetExportDialogOpen(open: boolean): void;
  onSetExportPassphrase(value: string): void;
  onSetExportPassphraseConfirmation(value: string): void;
  onSubmitExport(): Promise<void>;
  onSetImportDialogOpen(open: boolean): void;
  onSetImportExportPassphrase(value: string): void;
  onPreviewImport(): Promise<void>;
  onSetSelectedImportStableKeys(value: string[]): void;
  onSetImportStrategy(value: PortableImportConflictStrategy): void;
  onSetImportTargetStorageMode(value: CredentialStorageBackend): void;
  onSetImportEncryptedLocalPassphrase(value: string): void;
  onSetImportEncryptedLocalPassphraseConfirmation(value: string): void;
  onSubmitImport(): Promise<void>;
  onSetImportResultDialogOpen(open: boolean): void;
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
  isExportDialogOpen,
  isExportingCredentials,
  exportConnectionCount,
  exportError,
  exportFilePath,
  exportPassphrase,
  exportPassphraseConfirmation,
  isImportDialogOpen,
  isPreviewingCredentialImport,
  isApplyingCredentialImport,
  importError,
  importFilePath,
  importExportPassphrase,
  importPreview,
  selectedImportStableKeys,
  importStrategy,
  importTargetStorageMode,
  importEncryptedLocalPassphrase,
  importEncryptedLocalPassphraseConfirmation,
  credentialStorageState,
  isImportResultDialogOpen,
  importResult,
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
  onSetExportDialogOpen,
  onSetExportPassphrase,
  onSetExportPassphraseConfirmation,
  onSubmitExport,
  onSetImportDialogOpen,
  onSetImportExportPassphrase,
  onPreviewImport,
  onSetSelectedImportStableKeys,
  onSetImportStrategy,
  onSetImportTargetStorageMode,
  onSetImportEncryptedLocalPassphrase,
  onSetImportEncryptedLocalPassphraseConfirmation,
  onSubmitImport,
  onSetImportResultDialogOpen,
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
      <CredentialExportDialog
        connectionCount={exportConnectionCount}
        errorMessage={exportError}
        filePath={exportFilePath}
        isSubmitting={isExportingCredentials}
        open={isExportDialogOpen}
        passphrase={exportPassphrase}
        passphraseConfirmation={exportPassphraseConfirmation}
        t={t}
        onOpenChange={onSetExportDialogOpen}
        onPassphraseChange={onSetExportPassphrase}
        onPassphraseConfirmationChange={onSetExportPassphraseConfirmation}
        onSubmit={() => {
          void onSubmitExport();
        }}
      />

      <CredentialImportDialog
        credentialStorageState={credentialStorageState}
        encryptedLocalPassphrase={importEncryptedLocalPassphrase}
        encryptedLocalPassphraseConfirmation={importEncryptedLocalPassphraseConfirmation}
        errorMessage={importError}
        exportPassphrase={importExportPassphrase}
        filePath={importFilePath}
        isPreviewing={isPreviewingCredentialImport}
        isSubmitting={isApplyingCredentialImport}
        open={isImportDialogOpen}
        preview={importPreview}
        selectedStableKeys={selectedImportStableKeys}
        strategy={importStrategy}
        t={t}
        targetStorageMode={importTargetStorageMode}
        onEncryptedLocalPassphraseChange={onSetImportEncryptedLocalPassphrase}
        onEncryptedLocalPassphraseConfirmationChange={onSetImportEncryptedLocalPassphraseConfirmation}
        onExportPassphraseChange={onSetImportExportPassphrase}
        onOpenChange={onSetImportDialogOpen}
        onPreview={() => {
          void onPreviewImport();
        }}
        onSelectedStableKeysChange={onSetSelectedImportStableKeys}
        onStrategyChange={onSetImportStrategy}
        onSubmit={() => {
          void onSubmitImport();
        }}
        onTargetStorageModeChange={onSetImportTargetStorageMode}
      />

      <CredentialImportResultDialog
        importedCount={importResult?.importedConnectionIds.length ?? 0}
        open={isImportResultDialogOpen}
        replacedCount={importResult?.replacedConnectionIds.length ?? 0}
        skippedCount={importResult?.skippedStableKeys.length ?? 0}
        t={t}
        targetStorageMode={importResult?.targetStorageMode ?? "system_secure_storage"}
        onOpenChange={onSetImportResultDialogOpen}
      />

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
