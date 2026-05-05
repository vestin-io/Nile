import { useEffect, useState } from "react";

import type { DesktopConnection } from "../../../state/Types";
import type { Translator } from "../../shared/I18n";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

type CursorUsageRepairDialogProps = {
  connection: DesktopConnection | null;
  open: boolean;
  onOpenChange(open: boolean): void;
  onSubmit(connectionId: string, sessionToken: string): Promise<void>;
  t: Translator;
};

export function CursorUsageRepairDialog({
  connection,
  open,
  onOpenChange,
  onSubmit,
  t,
}: CursorUsageRepairDialogProps) {
  const [sessionToken, setSessionToken] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSessionToken("");
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [open, connection?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialog.cursorUsageRepair.title")}</DialogTitle>
          <DialogDescription>
            {t("dialog.cursorUsageRepair.description", {
              label: connection?.label ?? "",
            })}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!connection || !sessionToken.trim() || isSubmitting) {
              return;
            }

            setIsSubmitting(true);
            setErrorMessage(null);
            void onSubmit(connection.id, sessionToken.trim())
              .then(() => {
                onOpenChange(false);
              })
              .catch((error) => {
                setErrorMessage(error instanceof Error ? error.message : String(error));
              })
              .finally(() => {
                setIsSubmitting(false);
              });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="cursor-usage-session-token">{t("dialog.cursorUsageRepair.tokenLabel")}</Label>
            <Input
              id="cursor-usage-session-token"
              type="password"
              autoFocus
              value={sessionToken}
              onChange={(event) => setSessionToken(event.target.value)}
              placeholder={t("dialog.cursorUsageRepair.tokenPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("dialog.cursorUsageRepair.note")}</p>
          </div>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>{t("dialog.cursorUsageRepair.errorTitle")}</AlertTitle>
              <AlertDescription>
                {t("dialog.cursorUsageRepair.failed", { message: errorMessage })}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!connection || !sessionToken.trim() || isSubmitting}>
              {isSubmitting ? t("dialog.cursorUsageRepair.submitting") : t("common.repairUsage")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
