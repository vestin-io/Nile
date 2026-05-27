import type { CredentialStorageBackend, PortableImportConflictStrategy } from "@nile/core/services/credential";

import type {
  DesktopCredentialImportPreview,
  DesktopCredentialStorageState,
} from "../../../electron/connections/contracts";
import type { Translator } from "../../shared/I18n";
import { readSystemSecureStorageName } from "../../shared/Platform";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { FieldCard } from "../../ui/field";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";

type CredentialImportDialogProps = {
  credentialStorageState: DesktopCredentialStorageState;
  encryptedLocalPassphrase: string;
  encryptedLocalPassphraseConfirmation: string;
  errorMessage: string | null;
  exportPassphrase: string;
  filePath: string;
  isPreviewing: boolean;
  isSubmitting: boolean;
  open: boolean;
  preview: DesktopCredentialImportPreview | null;
  selectedStableKeys: string[];
  strategy: PortableImportConflictStrategy;
  t: Translator;
  targetStorageMode: CredentialStorageBackend;
  onEncryptedLocalPassphraseChange(value: string): void;
  onEncryptedLocalPassphraseConfirmationChange(value: string): void;
  onExportPassphraseChange(value: string): void;
  onOpenChange(open: boolean): void;
  onPreview(): void;
  onSelectedStableKeysChange(value: string[]): void;
  onStrategyChange(value: PortableImportConflictStrategy): void;
  onSubmit(): void;
  onTargetStorageModeChange(value: CredentialStorageBackend): void;
};

export function CredentialImportDialog({
  credentialStorageState,
  encryptedLocalPassphrase,
  encryptedLocalPassphraseConfirmation,
  errorMessage,
  exportPassphrase,
  filePath,
  isPreviewing,
  isSubmitting,
  open,
  preview,
  selectedStableKeys,
  strategy,
  t,
  targetStorageMode,
  onEncryptedLocalPassphraseChange,
  onEncryptedLocalPassphraseConfirmationChange,
  onExportPassphraseChange,
  onOpenChange,
  onPreview,
  onSelectedStableKeysChange,
  onStrategyChange,
  onSubmit,
  onTargetStorageModeChange,
}: CredentialImportDialogProps) {
  const systemSecureStorageName = readSystemSecureStorageName(t);
  const targetModeSelectable = preview !== null && preview.machine.mode === null;
  const targetRequiresEncryptedLocalPassphrase = targetStorageMode === "encrypted_local_storage"
    && (!credentialStorageState.encryptedLocalVaultExists || !credentialStorageState.encryptedLocalUnlocked);
  const targetRequiresEncryptedLocalConfirmation = targetRequiresEncryptedLocalPassphrase
    && !credentialStorageState.encryptedLocalVaultExists;
  const missingEncryptedLocalPassphrase = targetRequiresEncryptedLocalPassphrase
    && !encryptedLocalPassphrase.trim();
  const mismatchedEncryptedLocalPassphrase = targetRequiresEncryptedLocalConfirmation
    && encryptedLocalPassphrase !== encryptedLocalPassphraseConfirmation;
  const invalidEncryptedLocalPassphrase = missingEncryptedLocalPassphrase || mismatchedEncryptedLocalPassphrase;
  const selectedCount = selectedStableKeys.length;
  const previewConnections = preview?.connections ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl p-7">
        <DialogHeader className="space-y-2">
          <DialogTitle>{t("dialog.credentialImport.title")}</DialogTitle>
          <DialogDescription>{t("dialog.credentialImport.description")}</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1">
          <FieldCard
            label={t("dialog.credentialImport.fileLabel")}
            value={<span className="break-all">{filePath}</span>}
          />

          {preview === null ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="credential-import-passphrase">
                  {t("dialog.credentialImport.exportPassphrase")}
                </Label>
                <Input
                  id="credential-import-passphrase"
                  autoFocus
                  type="password"
                  value={exportPassphrase}
                  onChange={(event) => onExportPassphraseChange(event.target.value)}
                />
              </div>

              {errorMessage ? (
                <Alert>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : null}
            </>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <FieldCard
                  label={t("dialog.credentialImport.sourceLabel")}
                  value={t("dialog.credentialImport.sourceValue", {
                    platform: preview.source.platform,
                    storageMode: preview.source.storageMode === "encrypted_local_storage"
                      ? t("addConnection.storage.encrypted.title")
                      : t("addConnection.storage.system.title"),
                  })}
                />
                <FieldCard
                  label={t("dialog.credentialImport.selectionLabel")}
                  value={t("dialog.credentialImport.selectionValue", {
                    selected: String(selectedCount),
                    total: String(previewConnections.length),
                  })}
                />
              </div>

              <div className="grid gap-2">
                <Label>{t("dialog.credentialImport.connectionsLabel")}</Label>
                <div className="grid gap-2 rounded-xl border p-3">
                  {previewConnections.map((connection) => {
                    const checked = selectedStableKeys.includes(connection.stableKey);
                    return (
                      <label
                        key={connection.stableKey}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => {
                            const next = new Set(selectedStableKeys);
                            if (value) {
                              next.add(connection.stableKey);
                            } else {
                              next.delete(connection.stableKey);
                            }
                            onSelectedStableKeysChange([...next]);
                          }}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{connection.label}</div>
                          {connection.duplicateConnectionId ? (
                            <div className="text-sm text-muted-foreground">
                              {t("dialog.credentialImport.duplicateHint")}
                            </div>
                          ) : null}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t("dialog.credentialImport.strategyLabel")}</Label>
                  <Select value={strategy} onValueChange={(value) => onStrategyChange(value as PortableImportConflictStrategy)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip_existing">{t("dialog.credentialImport.strategySkip")}</SelectItem>
                      <SelectItem value="replace_existing">{t("dialog.credentialImport.strategyReplace")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>{t("dialog.credentialImport.targetStorageModeLabel")}</Label>
                  {targetModeSelectable ? (
                    <Select value={targetStorageMode} onValueChange={(value) => onTargetStorageModeChange(value as CredentialStorageBackend)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system_secure_storage">
                          {t("addConnection.storage.system.title")}
                        </SelectItem>
                        <SelectItem value="encrypted_local_storage">
                          {t("addConnection.storage.encrypted.title")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <FieldCard
                      label={t("dialog.credentialImport.targetStorageModeLabel")}
                      value={targetStorageMode === "encrypted_local_storage"
                        ? t("addConnection.storage.encrypted.title")
                        : t("addConnection.storage.system.title")}
                    />
                  )}
                </div>
              </div>

              {targetRequiresEncryptedLocalPassphrase ? (
                <div className="grid gap-4 rounded-xl border p-4">
                  <div className="text-sm text-muted-foreground">
                    {credentialStorageState.encryptedLocalVaultExists
                      ? t("dialog.credentialImport.targetEncryptedUnlockDescription")
                      : t("dialog.credentialImport.targetEncryptedSetupDescription")}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="credential-import-target-passphrase">
                      {t("dialog.credentialImport.targetEncryptedPassphrase")}
                    </Label>
                    <Input
                      id="credential-import-target-passphrase"
                      type="password"
                      value={encryptedLocalPassphrase}
                      onChange={(event) => onEncryptedLocalPassphraseChange(event.target.value)}
                    />
                  </div>

                  {targetRequiresEncryptedLocalConfirmation ? (
                    <div className="grid gap-2">
                      <Label htmlFor="credential-import-target-passphrase-confirmation">
                        {t("dialog.credentialImport.targetEncryptedPassphraseConfirm")}
                      </Label>
                      <Input
                        id="credential-import-target-passphrase-confirmation"
                        type="password"
                        value={encryptedLocalPassphraseConfirmation}
                        onChange={(event) => onEncryptedLocalPassphraseConfirmationChange(event.target.value)}
                      />
                    </div>
                  ) : null}

                  <div className="text-sm text-muted-foreground">
                    {t("dialog.credentialImport.targetEncryptedStorageHint", { systemSecureStorageName })}
                  </div>

                  {invalidEncryptedLocalPassphrase ? (
                    <Alert>
                      <AlertDescription>
                        {missingEncryptedLocalPassphrase
                          ? t("dialog.credentialImport.targetEncryptedPassphraseRequired")
                          : t("dialog.credentialImport.targetEncryptedPassphraseMismatch")}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              ) : null}

              {errorMessage ? (
                <Alert>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : null}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={isPreviewing || isSubmitting} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          {preview === null ? (
            <Button type="button" disabled={!exportPassphrase.trim() || isPreviewing} onClick={onPreview}>
              {isPreviewing ? t("dialog.credentialImport.previewing") : t("dialog.credentialImport.previewAction")}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={selectedCount === 0 || invalidEncryptedLocalPassphrase || isSubmitting}
              onClick={onSubmit}
            >
              {isSubmitting ? t("dialog.credentialImport.submitting") : t("dialog.credentialImport.submit")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
