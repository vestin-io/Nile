import type { AgentId } from "@nile/core/models/agent";

import type { Translator } from "../../shared/I18n";
import { formatAgentLabel } from "../../shared/AgentSelection";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { ChevronLeft } from "lucide-react";

type AddConnectionHeaderProps = {
  targetAgentId: AgentId | null;
  t: Translator;
  onBack(): void;
};

export function AddConnectionHeader({
  targetAgentId,
  t,
  onBack,
}: AddConnectionHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
          {t("common.back")}
        </Button>
        {targetAgentId ? (
          <Badge variant="secondary">{t("addConnection.forAgent", { agent: formatAgentLabel(targetAgentId) })}</Badge>
        ) : null}
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("page.addConnection")}</h1>
        <p className="text-sm text-muted-foreground">
          {targetAgentId
            ? t("addConnection.descriptionForAgent", { agent: formatAgentLabel(targetAgentId) })
            : t("addConnection.description")}
        </p>
      </div>
    </div>
  );
}
