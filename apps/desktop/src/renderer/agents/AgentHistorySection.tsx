import type { DesktopAgentState, DesktopHistoryEntry } from "../../DesktopTypes";
import type { Translator } from "../shared/I18n";
import {
  formatHistoryStatus,
  formatHistoryTimestamp,
  formatHistoryType,
} from "../shared/Support";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

type AgentHistorySectionProps = {
  agent: DesktopAgentState;
  entries: DesktopHistoryEntry[];
  t: Translator;
  onRollback(agentId: DesktopAgentState["agentId"]): Promise<void>;
};

export function AgentHistorySection({
  agent,
  entries,
  t,
  onRollback,
}: AgentHistorySectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void onRollback(agent.agentId)}
          disabled={!agent.canRollback || !agent.latestRollbackableMutationId}
        >
          {t("agents.rollbackLatest")}
        </Button>
      </div>

      {entries.length === 0 ? (
        <Alert>
          <AlertDescription>{t("agents.noHistoryEntries")}</AlertDescription>
        </Alert>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-background">
          {entries.map((entry) => {
            const hideTypeBadge =
              (entry.type === "apply_selection" && entry.status === "applied")
              || (entry.type === "rollback_latest" && entry.status === "rolled_back");

            return (
              <div key={entry.id} className="space-y-3 border-b px-4 py-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium">{entry.connectionLabel}</div>
                  {hideTypeBadge ? null : (
                    <Badge variant="outline">{formatHistoryType(entry.type, t)}</Badge>
                  )}
                  <Badge variant={entry.status === "failed" ? "danger" : "secondary"}>
                    {formatHistoryStatus(entry.status, t)}
                  </Badge>
                </div>
              <div className="text-sm text-muted-foreground">{entry.endpointLabel}</div>
              <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                <div>{t("agents.startedAt")} · {formatHistoryTimestamp(entry.startedAt)}</div>
                <div>{t("agents.completedAt")} · {formatHistoryTimestamp(entry.completedAt)}</div>
              </div>
              {entry.errorMessage ? (
                <Alert variant="destructive">
                  <AlertTitle>{t("agents.error")}</AlertTitle>
                  <AlertDescription>{entry.errorMessage}</AlertDescription>
                </Alert>
              ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
