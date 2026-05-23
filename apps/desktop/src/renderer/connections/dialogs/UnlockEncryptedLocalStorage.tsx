import { useEffect, useState } from "react";

import type { Translator } from "../../shared/I18n";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

type UnlockEncryptedLocalStorageDialogProps = {
  errorMessage: string | null;
  isSubmitting: boolean;
  open: boolean;
  t: Translator;
  onOpenChange(open: boolean): void;
  onSubmit(passphrase: string): Promise<void>;
};

export function UnlockEncryptedLocalStorageDialog({
  errorMessage,
  isSubmitting,
  open,
  t,
  onOpenChange,
  onSubmit,
}: UnlockEncryptedLocalStorageDialogProps) {
  const [passphrase, setPassphrase] = useState("");

  useEffect(() => {
    if (!open) {
      setPassphrase("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-7">
        <DialogHeader className="space-y-2">
          <DialogTitle>{t("dialog.encryptedLocalUnlock.title")}</DialogTitle>
          <DialogDescription>{t("dialog.encryptedLocalUnlock.description")}</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!passphrase.trim() || isSubmitting) {
              return;
            }
            void onSubmit(passphrase.trim());
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="encrypted-local-unlock-passphrase">
              {t("dialog.encryptedLocalUnlock.passphrase")}
            </Label>
            <Input
              id="encrypted-local-unlock-passphrase"
              autoFocus
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
            />
          </div>

          {errorMessage ? (
            <Alert>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!passphrase.trim() || isSubmitting}>
              {isSubmitting ? t("dialog.encryptedLocalUnlock.submitting") : t("dialog.encryptedLocalUnlock.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
