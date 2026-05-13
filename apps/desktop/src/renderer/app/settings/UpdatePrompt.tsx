import type { ReactNode } from "react";
import { AlertCircle, Download, RefreshCw, X } from "lucide-react";

import type { DesktopReleaseInfo } from "../../../state/Types";
import type { Translator } from "../../shared/I18n";
import { Badge } from "../../ui/badge";
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
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 w-[min(720px,calc(100vw-2rem))]">
      <Card className="pointer-events-auto rounded-[28px] border bg-background/95 p-6 shadow-2xl backdrop-blur-sm">
        <div className="flex items-start gap-5">
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
              content.iconClassName,
            )}
          >
            {content.icon}
          </div>
          <div className="min-w-0 flex-1 space-y-4 pt-0.5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[2rem] font-semibold tracking-tight leading-none">{content.title}</h3>
                {content.badgeLabel ? (
                  <Badge className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", content.badgeClassName)} variant="outline">
                    {content.badgeLabel}
                  </Badge>
                ) : null}
              </div>
              <p className="text-lg leading-7 text-muted-foreground">{content.description}</p>
              {content.meta ? (
                <p className="text-sm font-medium text-foreground/75">{content.meta}</p>
              ) : null}
            </div>
            {content.body ? content.body : null}
            {content.actions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3">
                {content.actions.map((action) => (
                  <Button
                    key={action.label}
                    className="rounded-2xl px-6"
                    variant={action.variant}
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
            className="h-9 w-9 shrink-0 rounded-full p-0 text-muted-foreground"
            variant="ghost"
            onClick={onDismiss}
          >
            <X className="h-5 w-5" />
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
        badgeLabel: t("settings.updates.prompt.downloadingBadge"),
        badgeClassName: "border-transparent bg-secondary text-secondary-foreground",
        title: t("settings.updates.prompt.downloadingTitle"),
        description: t("settings.updates.prompt.downloadingDescription", {
          version: info.availableVersion ?? t("common.unknown"),
        }),
        meta: t("settings.updates.prompt.downloadingMeta"),
        icon: <Download className="h-6 w-6" />,
        iconClassName: "bg-muted text-muted-foreground",
        body: (
          <div className="space-y-2">
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-foreground/70" />
            </div>
            <p className="text-sm text-muted-foreground">
              {t("settings.updates.prompt.downloadingHint")}
            </p>
          </div>
        ),
        actions: [],
      };
    case "ready":
      return {
        badgeLabel: t("settings.updates.prompt.readyBadge"),
        badgeClassName: "border-transparent bg-emerald-100 text-emerald-700",
        title: t("settings.updates.prompt.readyTitle"),
        description: t("settings.updates.prompt.readyDescription", {
          version: info.availableVersion ?? t("common.unknown"),
        }),
        meta: t("settings.updates.prompt.readyMeta"),
        icon: <RefreshCw className="h-6 w-6 text-emerald-600" />,
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
        badgeLabel: t("settings.updates.prompt.errorBadge"),
        badgeClassName: "border-transparent bg-destructive/10 text-destructive",
        title: t("settings.updates.prompt.errorTitle"),
        description: t("settings.updates.error", {
          message: info.errorMessage ?? t("settings.updates.errorUnknown"),
        }),
        meta: t("settings.updates.prompt.errorMeta"),
        icon: <AlertCircle className="h-6 w-6 text-destructive" />,
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
  badgeClassName?: string;
  badgeLabel?: string;
  body: ReactNode;
  description: string;
  icon: ReactNode;
  iconClassName: string;
  meta?: string;
  title: string;
};
