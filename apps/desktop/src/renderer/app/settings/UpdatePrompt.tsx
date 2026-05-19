import { X } from "lucide-react";

import type { DesktopReleaseInfo } from "../../../state/Types";
import type { Translator } from "../../shared/I18n";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";

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
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 w-[min(360px,calc(100vw-1rem))]">
      <Card className="pointer-events-auto border bg-card/95 p-3.5 shadow-md backdrop-blur-sm">
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="space-y-1">
              <h3 className="text-base font-semibold tracking-tight leading-none">{content.title}</h3>
              <p className="text-sm leading-5 text-muted-foreground">{content.description}</p>
            </div>
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
    case "ready":
      return {
        title: t("settings.updates.prompt.readyTitle"),
        description: t("settings.updates.prompt.readyDescription", {
          version: info.availableVersion ?? t("common.unknown"),
        }),
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
  description: string;
  title: string;
};
