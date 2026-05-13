import type { ReactNode } from "react";
import { AlertCircle, Download, RefreshCw, X } from "lucide-react";

import type { DesktopReleaseInfo } from "../../../state/Types";
import type { Translator } from "../../shared/I18n";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { cn } from "../../ui/cn";

type UpdatePromptProps = {
  info: DesktopReleaseInfo | null;
  t: Translator;
  onCheck(): Promise<void>;
  onDismiss(): void;
  onInstall(): Promise<void>;
  onOpenReleaseNotes(): Promise<void>;
};

export function UpdatePrompt({
  info,
  t,
  onCheck,
  onDismiss,
  onInstall,
  onOpenReleaseNotes,
}: UpdatePromptProps) {
  if (!info) {
    return null;
  }

  const content = readPromptContent(info, t, {
    onCheck,
    onInstall,
    onOpenReleaseNotes,
  });
  if (!content) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 w-[min(400px,calc(100vw-1rem))]">
      <Card className="pointer-events-auto border bg-card/95 p-3.5 shadow-md backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              content.iconClassName,
            )}
          >
            {content.icon}
          </div>
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <div className="space-y-1">
              <h3 className="text-base font-semibold tracking-tight leading-none">{content.title}</h3>
              <p className="text-sm leading-5 text-muted-foreground">{content.description}</p>
            </div>
            {content.body ? content.body : null}
            {content.actions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {content.actions.map((action) => (
                  <Button
                    key={action.label}
                    className="rounded-md"
                    variant={action.variant}
                    size="sm"
                    onClick={() => {
                      void action.run();
                    }}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
          <Button
            aria-label={t("common.close")}
            className="h-7 w-7 shrink-0 rounded-full p-0 text-muted-foreground"
            variant="ghost"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

function readPromptContent(
  info: DesktopReleaseInfo,
  t: Translator,
  actions: {
    onCheck(): Promise<void>;
    onInstall(): Promise<void>;
    onOpenReleaseNotes(): Promise<void>;
  },
): PromptContent | null {
  switch (info.status) {
    case "downloading":
      return {
        title: t("settings.updates.prompt.downloadingTitle"),
        description: t("settings.updates.prompt.downloadingDescription", {
          version: info.availableVersion ?? t("common.unknown"),
        }),
        icon: <Download className="h-5 w-5" />,
        iconClassName: "bg-muted text-muted-foreground",
        body: <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-foreground/70" />
        </div>,
        actions: [],
      };
    case "ready":
      return {
        title: t("settings.updates.prompt.readyTitle"),
        description: t("settings.updates.prompt.readyDescription", {
          version: info.availableVersion ?? t("common.unknown"),
        }),
        icon: <RefreshCw className="h-5 w-5 text-emerald-600" />,
        iconClassName: "bg-emerald-50 text-emerald-600",
        body: null,
        actions: [
          {
            label: t("settings.updates.prompt.seeChanges"),
            variant: "outline" as const,
            run: actions.onOpenReleaseNotes,
          },
          {
            label: t("settings.updates.prompt.restartNow"),
            variant: "default" as const,
            run: actions.onInstall,
          },
        ] satisfies Array<PromptAction>,
      };
    case "error":
      return {
        title: t("settings.updates.prompt.errorTitle"),
        description: t("settings.updates.error", {
          message: info.errorMessage ?? t("settings.updates.errorUnknown"),
        }),
        icon: <AlertCircle className="h-5 w-5 text-destructive" />,
        iconClassName: "bg-destructive/10 text-destructive",
        body: null,
        actions: [
          {
            label: t("settings.updates.prompt.retry"),
            variant: "default" as const,
            run: actions.onCheck,
          },
        ] satisfies Array<PromptAction>,
      };
    default:
      return null;
  }
}

type PromptAction = {
  label: string;
  variant: "default" | "outline";
  run(): Promise<void>;
};

type PromptContent = {
  actions: Array<PromptAction>;
  body: ReactNode;
  description: string;
  icon: ReactNode;
  iconClassName: string;
  title: string;
};
