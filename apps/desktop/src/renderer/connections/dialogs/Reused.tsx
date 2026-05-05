import type { Translator } from "../../shared/I18n";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";

type ReusedConnectionDialogProps = {
  open: boolean;
  t: Translator;
  onContinue(): void;
};

export function ReusedConnectionDialog({
  open,
  t,
  onContinue,
}: ReusedConnectionDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onContinue();
        }
      }}
    >
      <DialogContent className="max-w-md rounded-2xl p-7">
        <DialogHeader className="space-y-2">
          <DialogTitle>{t("addConnection.reusedTitle")}</DialogTitle>
          <DialogDescription>{t("addConnection.reusedDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end pt-2">
          <Button onClick={onContinue}>
            {t("addConnection.reusedContinue")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
