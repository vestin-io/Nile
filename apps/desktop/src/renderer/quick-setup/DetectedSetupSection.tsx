import { useState } from "react";
import type { AgentId } from "@nile/core/models/agent/types";
import { ArrowDownToLine, Check, LoaderCircle } from "lucide-react";

import type { DesktopOnboardingItem } from "../../DesktopTypes";
import type { Translator } from "../shared/I18n";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

type DetectedSetupSectionProps = {
  agentId: AgentId;
  canConfigure: boolean;
  confirmed: boolean;
  detectedSetup: DesktopOnboardingItem | null;
  t: Translator;
  onConfigure(agentId: AgentId): void;
  onSave(agentId: AgentId): Promise<void>;
};

export function DetectedSetupSection({
  agentId,
  canConfigure,
  confirmed,
  detectedSetup,
  t,
  onConfigure,
  onSave,
}: DetectedSetupSectionProps) {
  const [isSaving, setIsSaving] = useState(false);
  const isNewSetup = detectedSetup?.state === "new";
  const hasLocalSetup = detectedSetup?.state === "new" || detectedSetup?.state === "already_saved";
  const setupContent = readSetupContent(agentId, detectedSetup, t);

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
      <div className="max-w-[42rem] px-2 py-2">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-medium text-foreground">{setupContent.primary}</div>
            {isNewSetup ? (
              <Badge
                className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/80 dark:bg-amber-950/40 dark:text-amber-200"
                variant="outline"
              >
                {t("quickSetup.newSetupBadge")}
              </Badge>
            ) : null}
          </div>
          {setupContent.secondary ? (
            <div className="text-sm text-muted-foreground">{setupContent.secondary}</div>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 md:items-end">
        {confirmed ? (
          <div
            aria-label={t("quickSetup.confirmedAction")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
            title={t("quickSetup.confirmedAction")}
          >
            <Check className="h-4 w-4" />
          </div>
        ) : hasLocalSetup ? (
          <Button
            className="gap-2 pl-3 pr-4 shadow-sm hover:shadow"
            disabled={isSaving}
            size="sm"
            onClick={() => {
              if (isSaving) {
                return;
              }

              setIsSaving(true);
              void onSave(agentId).finally(() => {
                setIsSaving(false);
              });
            }}
          >
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
            {t("quickSetup.looksGood")}
          </Button>
        ) : canConfigure ? (
          <Button size="sm" onClick={() => onConfigure(agentId)}>
            {t("quickSetup.configureNow")}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled>
            {t("quickSetup.configureUnavailable")}
          </Button>
        )}
      </div>
    </div>
  );
}

function readSetupContent(
  agentId: AgentId,
  detectedSetup: DesktopOnboardingItem | null,
  t: Translator,
): { primary: string; secondary?: string } {
  if (!detectedSetup || detectedSetup.state === "unavailable" || detectedSetup.state === "unsupported") {
    return {
      primary: t("quickSetup.noLocalSetupSecondary", { agent: formatAgentLabel(agentId) }),
    };
  }

  const title = stripAgentPrefix(detectedSetup.title, formatAgentLabel(agentId));
  return {
    primary: title,
    secondary: formatDetectedSubtitle(detectedSetup.subtitle, t),
  };
}

function formatDetectedSubtitle(value: string, t: Translator): string {
  const parts = value.split(" • ");
  if (parts.length !== 2) {
    return value;
  }

  const [endpointLabel, authMode] = parts;
  const authLabel = readAuthLabel(authMode, t);
  return `${endpointLabel} • ${authLabel}`;
}

function readAuthLabel(authMode: string, t: Translator): string {
  const key = `auth.${authMode}`;
  const translated = t(key);
  if (translated !== key) {
    return translated;
  }

  return authMode
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAgentLabel(agentId: AgentId): string {
  return agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

function stripAgentPrefix(value: string, agentLabel: string): string {
  const prefix = `${agentLabel} · `;
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}
