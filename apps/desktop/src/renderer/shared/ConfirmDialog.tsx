import type { Translator } from "./I18n";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

type ConfirmDialogProps = {
  confirmLabel: string;
  description: string;
  isConfirming: boolean;
  open: boolean;
  title: string;
  t: Translator;
  onConfirm(): Promise<void>;
  onOpenChange(open: boolean): void;
};

export function ConfirmDialog({
  confirmLabel,
  description,
  isConfirming,
  open,
  title,
  t,
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-7">
        <DialogHeader className="space-y-2">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isConfirming}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={isConfirming}
            onClick={() => {
              if (isConfirming) {
                return;
              }
              void onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
