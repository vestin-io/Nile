import { useEffect, useState } from "react";

import type { CredentialStorageBackend } from "@nile/core/services/credential";

import type { Translator } from "../../shared/I18n";
import { readSystemSecureStorageName } from "../../shared/Platform";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Button } from "../../ui/button";
import { Alert, AlertDescription } from "../../ui/alert";

type CredentialStorageDialogProps = {
  backend: CredentialStorageBackend;
  errorMessage?: string | null;
  encryptedLocalPassphrase: string;
  encryptedLocalPassphraseConfirmation: string;
  encryptedLocalVaultExists: boolean;
  encryptedLocalUnlocked: boolean;
  open: boolean;
  t: Translator;
  onConfirm(): void;
  onEncryptedLocalPassphraseChange(value: string): void;
  onEncryptedLocalPassphraseConfirmationChange(value: string): void;
  onOpenChange(open: boolean): void;
};

export function CredentialStorageDialog({
  backend,
  errorMessage,
  encryptedLocalPassphrase,
  encryptedLocalPassphraseConfirmation,
  encryptedLocalVaultExists,
  encryptedLocalUnlocked,
  open,
  t,
  onConfirm,
  onEncryptedLocalPassphraseChange,
  onEncryptedLocalPassphraseConfirmationChange,
  onOpenChange,
}: CredentialStorageDialogProps) {
  const systemSecureStorageName = readSystemSecureStorageName(t);
  const [passphraseTouched, setPassphraseTouched] = useState(false);
  const [confirmationTouched, setConfirmationTouched] = useState(false);
  const requiresEncryptedLocalPassphrase = backend === "encrypted_local_storage" && !encryptedLocalUnlocked;
  const requiresEncryptedLocalConfirmation = requiresEncryptedLocalPassphrase && !encryptedLocalVaultExists;
  const missingPassphrase = requiresEncryptedLocalPassphrase && !encryptedLocalPassphrase.trim();
  const mismatchedConfirmation = requiresEncryptedLocalConfirmation
    && encryptedLocalPassphrase !== encryptedLocalPassphraseConfirmation;
  const encryptedLocalPassphraseInvalid = missingPassphrase || mismatchedConfirmation;
  const shouldShowValidation = passphraseTouched
    || (requiresEncryptedLocalConfirmation && confirmationTouched);

  const title = requiresEncryptedLocalPassphrase
    ? (encryptedLocalVaultExists
      ? t("dialog.encryptedLocalUnlock.title")
      : t("dialog.credentialStorage.encryptedSetupTitle"))
    : t("dialog.credentialStorage.confirmTitle");
  const description = requiresEncryptedLocalPassphrase
    ? (encryptedLocalVaultExists
      ? t("addConnection.storage.encrypted.unlockDescription")
      : t("addConnection.storage.encrypted.passphraseDescription"))
    : t("dialog.credentialStorage.confirmDescription");

  useEffect(() => {
    if (!open) {
      setPassphraseTouched(false);
      setConfirmationTouched(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-7">
        <DialogHeader className="space-y-2">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1 rounded-xl border border-border/80 bg-muted/30 p-4">
            <div className="text-sm font-medium">
              {backend === "system_secure_storage"
                ? t("addConnection.storage.system.title")
                : t("addConnection.storage.encrypted.title")}
            </div>
            <div className="text-sm text-muted-foreground">
              {backend === "system_secure_storage"
                ? t("addConnection.storage.system.description", { systemSecureStorageName })
                : t("addConnection.storage.encrypted.description")}
            </div>
          </div>

          {requiresEncryptedLocalPassphrase ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="credential-storage-passphrase">
                  {t("addConnection.storage.encrypted.passphrase")}
                </Label>
                <Input
                  id="credential-storage-passphrase"
                  autoFocus
                  type="password"
                  value={encryptedLocalPassphrase}
                  onChange={(event) => {
                    setPassphraseTouched(true);
                    onEncryptedLocalPassphraseChange(event.target.value);
                  }}
                />
              </div>

              {requiresEncryptedLocalConfirmation ? (
                <div className="grid gap-2">
                  <Label htmlFor="credential-storage-passphrase-confirmation">
                    {t("addConnection.storage.encrypted.passphraseConfirm")}
                  </Label>
                  <Input
                    id="credential-storage-passphrase-confirmation"
                    type="password"
                    value={encryptedLocalPassphraseConfirmation}
                    onChange={(event) => {
                      setConfirmationTouched(true);
                      onEncryptedLocalPassphraseConfirmationChange(event.target.value);
                    }}
                  />
                </div>
              ) : null}

              <div className="text-sm text-muted-foreground">
                {t("addConnection.storage.encrypted.forgetWarning")}
              </div>

              {encryptedLocalPassphraseInvalid && shouldShowValidation ? (
                <Alert>
                  <AlertDescription>
                    {missingPassphrase
                      ? t("addConnection.storage.encrypted.passphraseRequired")
                      : t("addConnection.storage.encrypted.passphraseMismatch")}
                  </AlertDescription>
                </Alert>
              ) : null}

              {errorMessage ? (
                <Alert>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : null}
            </>
          ) : null}

        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={encryptedLocalPassphraseInvalid}>
            {t("dialog.credentialStorage.continue")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
