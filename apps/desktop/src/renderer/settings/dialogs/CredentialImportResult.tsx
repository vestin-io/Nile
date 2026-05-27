import type { CredentialStorageBackend } from "@nile/core/services/credential";

import type { Translator } from "../../shared/I18n";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { FieldCard } from "../../ui/field";

type CredentialImportResultDialogProps = {
  importedCount: number;
  open: boolean;
  replacedCount: number;
  skippedCount: number;
  t: Translator;
  targetStorageMode: CredentialStorageBackend;
  onOpenChange(open: boolean): void;
};

export function CredentialImportResultDialog({
  importedCount,
  open,
  replacedCount,
  skippedCount,
  t,
  targetStorageMode,
  onOpenChange,
}: CredentialImportResultDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-7">
        <DialogHeader className="space-y-2">
          <DialogTitle>{t("dialog.credentialImportResult.title")}</DialogTitle>
          <DialogDescription>{t("dialog.credentialImportResult.description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <FieldCard
            label={t("dialog.credentialImportResult.importedLabel")}
            value={String(importedCount)}
          />
          <FieldCard
            label={t("dialog.credentialImportResult.replacedLabel")}
            value={String(replacedCount)}
          />
          <FieldCard
            label={t("dialog.credentialImportResult.skippedLabel")}
            value={String(skippedCount)}
          />
          <FieldCard
            label={t("dialog.credentialImportResult.targetStorageLabel")}
            value={targetStorageMode === "encrypted_local_storage"
              ? t("addConnection.storage.encrypted.title")
              : t("addConnection.storage.system.title")}
          />
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t("common.done")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
