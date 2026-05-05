import nileMarkSvg from "../../../../../assets/icons/nile-mark.svg";

import type { Translator } from "../../shared/I18n";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "../../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";

type NileDialogProps = {
  open: boolean;
  t: Translator;
  onOpenChange(open: boolean): void;
  onOpenGitHubIssues(): Promise<void>;
  onOpenSupport(): Promise<void>;
};

export function NileDialog({
  open,
  t,
  onOpenChange,
  onOpenGitHubIssues,
  onOpenSupport,
}: NileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-7">
        <DialogHeader className="items-center space-y-4 text-center sm:text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 text-foreground ring-1 ring-border">
            <div
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center [&_svg]:h-8 [&_svg]:w-8"
              dangerouslySetInnerHTML={{ __html: nileMarkSvg }}
            />
          </div>
          <div className="space-y-2">
            <DialogTitle>{t("nile.dialog.title")}</DialogTitle>
            <DialogDescription>{t("nile.dialog.description")}</DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <Card className="text-left shadow-none">
            <CardContent className="p-4">
              <CardTitle className="text-sm">{t("nile.dialog.aboutTitle")}</CardTitle>
              <CardDescription className="mt-1">{t("nile.dialog.aboutDescription")}</CardDescription>
            </CardContent>
          </Card>

          <Card className="text-left shadow-none">
            <CardContent className="p-4">
              <CardTitle className="text-sm">{t("nile.dialog.supportTitle")}</CardTitle>
              <CardDescription className="mt-1">{t("nile.dialog.supportDescription")}</CardDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void onOpenSupport()}>
                  {t("nile.dialog.supportAction")}
                </Button>
                <Button variant="outline" onClick={() => void onOpenGitHubIssues()}>
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2C6.476 2 2 6.59 2 12.253c0 4.53 2.865 8.374 6.839 9.73.5.095.682-.222.682-.493 0-.244-.009-.891-.014-1.748-2.782.617-3.369-1.37-3.369-1.37-.454-1.18-1.11-1.495-1.11-1.495-.908-.635.069-.622.069-.622 1.004.072 1.532 1.056 1.532 1.056.892 1.564 2.341 1.112 2.91.85.091-.665.349-1.112.635-1.368-2.22-.26-4.555-1.137-4.555-5.061 0-1.118.389-2.032 1.027-2.748-.103-.261-.446-1.31.097-2.73 0 0 .838-.275 2.75 1.05A9.37 9.37 0 0 1 12 6.844c.85.004 1.705.118 2.504.346 1.91-1.325 2.747-1.05 2.747-1.05.545 1.42.202 2.469.1 2.73.64.716 1.025 1.63 1.025 2.748 0 3.934-2.338 4.798-4.566 5.053.359.318.678.946.678 1.907 0 1.378-.012 2.49-.012 2.828 0 .274.18.593.688.492C19.137 20.623 22 16.78 22 12.253 22 6.59 17.523 2 12 2Z" />
                  </svg>
                  {t("nile.dialog.githubAction")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="pt-1 text-center text-xs text-muted-foreground">
          {t("nile.dialog.copyright")}
        </div>
      </DialogContent>
    </Dialog>
  );
}
