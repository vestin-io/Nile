import type { Translator } from "../../shared/I18n";
import { nileMarkSvg } from "../../shared/NileMark";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";

type ResetStateDialogProps = {
  isResetting: boolean;
  open: boolean;
  onConfirm(): Promise<void>;
  onOpenChange(open: boolean): void;
  t: Translator;
};

export function ResetStateDialog({
  isResetting,
  open,
  onConfirm,
  onOpenChange,
  t,
}: ResetStateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-7">
        <DialogHeader className="items-center space-y-4 text-center sm:text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900">
            <div
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center [&_svg]:h-10 [&_svg]:w-10"
              dangerouslySetInnerHTML={{ __html: nileMarkSvg }}
            />
          </div>
          <div className="space-y-2">
            <DialogTitle>{t("settings.reset.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("settings.reset.confirm")}</DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex justify-center gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isResetting}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (isResetting) {
                return;
              }
              void onConfirm();
            }}
            disabled={isResetting}
          >
            {isResetting ? t("settings.reset.inProgress") : t("settings.reset.action")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
