import { ArrowRight, RefreshCw } from "lucide-react";

import type { DesktopReleaseInfo } from "../../DesktopTypes";
import type { Translator } from "../shared/I18n";
import { cn } from "../lib/cn";
import { Button } from "../ui/button";
import { SettingsSection } from "./SettingsSection";

type UpdateSectionProps = {
  info: DesktopReleaseInfo | null;
  onCheck(): Promise<void>;
  onInstall(): Promise<void>;
  t: Translator;
};

export function UpdateSection({
  info,
  onCheck,
  onInstall,
  t,
}: UpdateSectionProps) {
  const versionLabel = info && info.version !== "0.0.0"
    ? info.version
    : t("settings.updates.developmentVersion");
  const canCheckForUpdates = info?.updateAvailability === "available";
  const canInstallUpdate = info?.status === "ready";
  const helperText = readHelperText(info, t);

  return (
    <SettingsSection
      title={t("settings.updates.title")}
      description={t("settings.updates.description")}
    >
      <div className="flex flex-wrap items-center gap-3 md:flex-nowrap">
        <div className="inline-flex min-h-10 items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">{t("settings.updates.versionLabel")}</span>
          <span className="font-mono text-sm tracking-tight">{versionLabel}</span>
          {info?.availableVersion ? (
            <>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-sm tracking-tight text-foreground">
                {info.availableVersion}
              </span>
            </>
          ) : null}
        </div>
        <div className="md:ml-auto flex items-center gap-2">
          {canCheckForUpdates ? (
            <Button
              aria-label={t("settings.updates.check")}
              className="h-10 w-10 rounded-full p-0"
              disabled={info?.status === "checking"}
              title={t("settings.updates.check")}
              variant="outline"
              onClick={() => {
                void onCheck();
              }}
            >
              <RefreshCw className={cn("h-4 w-4", info?.status === "checking" && "animate-spin")} />
            </Button>
          ) : null}
          {canInstallUpdate ? (
            <Button className="rounded-full px-4" size="sm" onClick={() => void onInstall()}>
              {t("settings.updates.install")}
            </Button>
          ) : null}
        </div>
      </div>
      {helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </SettingsSection>
  );
}

function readHelperText(info: DesktopReleaseInfo | null, t: Translator): string | null {
  if (!info) {
    return null;
  }

  if (info.status === "no_update") {
    return t("settings.updates.noUpdate");
  }

  if (info.status === "ready") {
    return t("settings.updates.ready");
  }

  switch (info.updateAvailability) {
    case "unsupported_platform":
      return t("settings.updates.unavailablePlatform");
    default:
      return null;
  }
}
