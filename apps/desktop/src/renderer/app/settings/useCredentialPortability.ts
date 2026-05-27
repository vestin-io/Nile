import { useState } from "react";

import type { CredentialStorageBackend, PortableImportConflictStrategy } from "@nile/core/services/credential";

import type {
  DesktopApplyCredentialImportResult,
  DesktopCredentialExportPreview,
  DesktopCredentialImportPreview,
  DesktopCredentialStorageState,
} from "../../../electron/connections/contracts";
import type { Translator } from "../../shared/I18n";

type CredentialPortabilityOptions = {
  credentialStorageMode: CredentialStorageBackend | null;
  credentialStorageState: DesktopCredentialStorageState;
  isMixed: boolean;
  requestEncryptedLocalUnlock(hint?: string): Promise<void>;
  refresh(): Promise<void>;
  refreshCredentialStorageState(): Promise<DesktopCredentialStorageState>;
  setActionError(message: string | null): void;
  t: Translator;
};

type CredentialPortabilityResult = {
  isBusy: boolean;
  isExportDialogOpen: boolean;
  isExporting: boolean;
  exportConnectionCount: number;
  exportError: string | null;
  exportFilePath: string;
  exportPassphrase: string;
  exportPassphraseConfirmation: string;
  isImportDialogOpen: boolean;
  isPreviewingImport: boolean;
  isApplyingImport: boolean;
  importError: string | null;
  importFilePath: string;
  importExportPassphrase: string;
  importPreview: DesktopCredentialImportPreview | null;
  selectedImportStableKeys: string[];
  importStrategy: PortableImportConflictStrategy;
  importTargetStorageMode: CredentialStorageBackend;
  importEncryptedLocalPassphrase: string;
  importEncryptedLocalPassphraseConfirmation: string;
  importResult: DesktopApplyCredentialImportResult | null;
  isImportResultDialogOpen: boolean;
  onOpenExport(selectedConnectionIds?: string[]): Promise<void>;
  onOpenImport(): Promise<void>;
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
};

export function useCredentialPortability({
  credentialStorageMode,
  credentialStorageState,
  isMixed,
  requestEncryptedLocalUnlock,
  refresh,
  refreshCredentialStorageState,
  setActionError,
  t,
}: CredentialPortabilityOptions): CredentialPortabilityResult {
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportFilePath, setExportFilePath] = useState("");
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [exportPassphraseConfirmation, setExportPassphraseConfirmation] = useState("");
  const [exportPreview, setExportPreview] = useState<DesktopCredentialExportPreview | null>(null);
  const [selectedExportConnectionIds, setSelectedExportConnectionIds] = useState<string[]>([]);

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importFilePath, setImportFilePath] = useState("");
  const [importExportPassphrase, setImportExportPassphrase] = useState("");
  const [importPreview, setImportPreview] = useState<DesktopCredentialImportPreview | null>(null);
  const [selectedImportStableKeys, setSelectedImportStableKeys] = useState<string[]>([]);
  const [importStrategy, setImportStrategy] = useState<PortableImportConflictStrategy>("skip_existing");
  const [importTargetStorageMode, setImportTargetStorageMode] = useState<CredentialStorageBackend>(
    credentialStorageMode ?? "system_secure_storage",
  );
  const [importEncryptedLocalPassphrase, setImportEncryptedLocalPassphrase] = useState("");
  const [importEncryptedLocalPassphraseConfirmation, setImportEncryptedLocalPassphraseConfirmation] = useState("");
  const [importResult, setImportResult] = useState<DesktopApplyCredentialImportResult | null>(null);
  const [isImportResultDialogOpen, setIsImportResultDialogOpen] = useState(false);

  const isBusy = isExporting || isPreviewingImport || isApplyingImport;

  async function onOpenExport(selectedConnectionIds?: string[]): Promise<void> {
    setActionError(null);
    if (isMixed) {
      setActionError(t("settings.credentialStorage.mixedError"));
      return;
    }
    if (
      credentialStorageMode === "encrypted_local_storage"
      && credentialStorageState.encryptedLocalVaultExists
      && !credentialStorageState.encryptedLocalUnlocked
    ) {
      await requestEncryptedLocalUnlock(t("dialog.encryptedLocalUnlock.reasonExportBundle"));
    }
    const selectedIds = selectedConnectionIds ?? [];
    const preview = await window.nileDesktop.connections.previewCredentialExport({
      ...(selectedIds.length > 0 ? { selectedConnectionIds: selectedIds } : {}),
    });
    if (!preview.canExport) {
      setActionError(t("settings.credentialPortability.exportUnavailable"));
      return;
    }
    const defaultFileName = readDefaultBundleFileName();
    setExportPreview(preview);
    setExportError(null);
    setExportFilePath(defaultFileName);
    setExportPassphrase("");
    setExportPassphraseConfirmation("");
    setSelectedExportConnectionIds(selectedIds);
    setIsExportDialogOpen(true);
  }

  async function onSubmitExport(): Promise<void> {
    setIsExporting(true);
    setExportError(null);
    try {
      const filePath = await window.nileDesktop.connections.chooseCredentialExportPath(exportFilePath);
      if (!filePath) {
        return;
      }
      await window.nileDesktop.connections.exportCredentialBundle({
        filePath,
        exportPassphrase,
        ...(selectedExportConnectionIds.length > 0 ? { selectedConnectionIds: selectedExportConnectionIds } : {}),
      });
      setIsExportDialogOpen(false);
      setExportFilePath(filePath);
      setExportPassphrase("");
      setExportPassphraseConfirmation("");
      setSelectedExportConnectionIds([]);
    } catch (error) {
      setExportError(readErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  }

  async function onOpenImport(): Promise<void> {
    setActionError(null);
    if (isMixed) {
      setActionError(t("settings.credentialStorage.mixedError"));
      return;
    }
    if (
      credentialStorageMode === "encrypted_local_storage"
      && credentialStorageState.encryptedLocalVaultExists
      && !credentialStorageState.encryptedLocalUnlocked
    ) {
      await requestEncryptedLocalUnlock(t("dialog.encryptedLocalUnlock.reasonImportBundle"));
    }
    const filePath = await window.nileDesktop.connections.chooseCredentialImportPath();
    if (!filePath) {
      return;
    }
    setImportFilePath(filePath);
    setImportExportPassphrase("");
    setImportPreview(null);
    setImportError(null);
    setSelectedImportStableKeys([]);
    setImportStrategy("skip_existing");
    setImportTargetStorageMode(credentialStorageMode ?? "system_secure_storage");
    setImportEncryptedLocalPassphrase("");
    setImportEncryptedLocalPassphraseConfirmation("");
    setIsImportDialogOpen(true);
  }

  async function onPreviewImport(): Promise<void> {
    setIsPreviewingImport(true);
    setImportError(null);
    try {
      const preview = await window.nileDesktop.connections.previewCredentialImport({
        filePath: importFilePath,
        exportPassphrase: importExportPassphrase,
      });
      setImportPreview(preview);
      setSelectedImportStableKeys(preview.connections.map((connection) => connection.stableKey));
      setImportTargetStorageMode(preview.machine.mode ?? credentialStorageMode ?? "system_secure_storage");
    } catch (error) {
      setImportError(readErrorMessage(error));
    } finally {
      setIsPreviewingImport(false);
    }
  }

  async function onSubmitImport(): Promise<void> {
    setIsApplyingImport(true);
    setImportError(null);
    try {
      const result = await window.nileDesktop.connections.applyCredentialImport({
        filePath: importFilePath,
        exportPassphrase: importExportPassphrase,
        strategy: importStrategy,
        selectedStableKeys: selectedImportStableKeys,
        targetStorageMode: importTargetStorageMode,
        encryptedLocalPassphrase: importTargetStorageMode === "encrypted_local_storage"
          ? importEncryptedLocalPassphrase
          : undefined,
      });
      setImportResult(result);
      setIsImportDialogOpen(false);
      setIsImportResultDialogOpen(true);
      try {
        await refresh();
        await refreshCredentialStorageState();
      } catch {
        setActionError(t("settings.credentialPortability.importRefreshWarning"));
      }
    } catch (error) {
      setImportError(readErrorMessage(error));
    } finally {
      setIsApplyingImport(false);
    }
  }

  return {
    isBusy,
    isExportDialogOpen,
    isExporting,
    exportConnectionCount: exportPreview?.connectionCount ?? 0,
    exportError,
    exportFilePath,
    exportPassphrase,
    exportPassphraseConfirmation,
    isImportDialogOpen,
    isPreviewingImport,
    isApplyingImport,
    importError,
    importFilePath,
    importExportPassphrase,
    importPreview,
    selectedImportStableKeys,
    importStrategy,
    importTargetStorageMode,
    importEncryptedLocalPassphrase,
    importEncryptedLocalPassphraseConfirmation,
    importResult,
    isImportResultDialogOpen,
    onOpenExport,
    onOpenImport,
    onSetExportDialogOpen: setIsExportDialogOpen,
    onSetExportPassphrase: setExportPassphrase,
    onSetExportPassphraseConfirmation: setExportPassphraseConfirmation,
    onSubmitExport,
    onSetImportDialogOpen: setIsImportDialogOpen,
    onSetImportExportPassphrase: setImportExportPassphrase,
    onPreviewImport,
    onSetSelectedImportStableKeys: setSelectedImportStableKeys,
    onSetImportStrategy: setImportStrategy,
    onSetImportTargetStorageMode: setImportTargetStorageMode,
    onSetImportEncryptedLocalPassphrase: setImportEncryptedLocalPassphrase,
    onSetImportEncryptedLocalPassphraseConfirmation: setImportEncryptedLocalPassphraseConfirmation,
    onSubmitImport,
    onSetImportResultDialogOpen: setIsImportResultDialogOpen,
  };
}

function readDefaultBundleFileName(): string {
  const now = new Date();
  const date = [
    now.getFullYear().toString().padStart(4, "0"),
    (now.getMonth() + 1).toString().padStart(2, "0"),
    now.getDate().toString().padStart(2, "0"),
  ].join("-");
  return `nile-credentials-${date}.nilevault`;
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
