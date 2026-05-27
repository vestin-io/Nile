import { useEffect, useState } from "react";

import type { Translator } from "../../shared/I18n";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { FieldCard } from "../../ui/field";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

type CredentialExportDialogProps = {
  connectionCount: number;
  errorMessage: string | null;
  filePath: string;
  isSubmitting: boolean;
  open: boolean;
  passphrase: string;
  passphraseConfirmation: string;
  t: Translator;
  onOpenChange(open: boolean): void;
  onPassphraseChange(value: string): void;
  onPassphraseConfirmationChange(value: string): void;
  onSubmit(): void;
};

export function CredentialExportDialog({
  connectionCount,
  errorMessage,
  filePath,
  isSubmitting,
  open,
  passphrase,
  passphraseConfirmation,
  t,
  onOpenChange,
  onPassphraseChange,
  onPassphraseConfirmationChange,
  onSubmit,
}: CredentialExportDialogProps) {
  const [passphraseTouched, setPassphraseTouched] = useState(false);
  const [confirmationTouched, setConfirmationTouched] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassphraseTouched(false);
      setConfirmationTouched(false);
    }
  }, [open]);

  const missingPassphrase = !passphrase.trim();
  const mismatchedPassphrase = passphrase !== passphraseConfirmation;
  const invalid = missingPassphrase || mismatchedPassphrase;
  const showValidation = passphraseTouched || confirmationTouched;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-7">
        <DialogHeader className="space-y-2">
          <DialogTitle>{t("dialog.credentialExport.title")}</DialogTitle>
          <DialogDescription>{t("dialog.credentialExport.description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <FieldCard
            label={t("dialog.credentialExport.fileLabel")}
            value={<span className="break-all">{filePath}</span>}
          />
          <FieldCard
            label={t("dialog.credentialExport.connectionCountLabel")}
            value={t("dialog.credentialExport.connectionCountValue", { count: String(connectionCount) })}
          />

          <div className="grid gap-2">
            <Label htmlFor="credential-export-passphrase">{t("dialog.credentialExport.passphrase")}</Label>
            <Input
              id="credential-export-passphrase"
              autoFocus
              type="password"
              value={passphrase}
              onChange={(event) => {
                setPassphraseTouched(true);
                onPassphraseChange(event.target.value);
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="credential-export-passphrase-confirmation">
              {t("dialog.credentialExport.passphraseConfirm")}
            </Label>
            <Input
              id="credential-export-passphrase-confirmation"
              type="password"
              value={passphraseConfirmation}
              onChange={(event) => {
                setConfirmationTouched(true);
                onPassphraseConfirmationChange(event.target.value);
              }}
            />
          </div>

          <div className="text-sm text-muted-foreground">
            {t("dialog.credentialExport.passphraseDescription")}
          </div>

          {invalid && showValidation ? (
            <Alert>
              <AlertDescription>
                {missingPassphrase
                  ? t("dialog.credentialExport.passphraseRequired")
                  : t("dialog.credentialExport.passphraseMismatch")}
              </AlertDescription>
            </Alert>
          ) : null}

          {errorMessage ? (
            <Alert>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={invalid || isSubmitting} onClick={onSubmit}>
            {isSubmitting ? t("dialog.credentialExport.submitting") : t("dialog.credentialExport.submit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
