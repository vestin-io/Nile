import type { DesktopAgentState } from "../../../state/Types";
import type { Translator } from "../../shared/I18n";
import { UsagePanel } from "../../shared/UsagePanel";
import { UsageIndicator } from "../../shared/UsageIndicator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";

type AgentCurrentConnectionPanelProps = {
  agent: DesktopAgentState;
  disabled: boolean;
  t: Translator;
  onSwitch(connectionId: string): void;
};

export function AgentCurrentConnectionPanel({
  agent,
  disabled,
  t,
  onSwitch,
}: AgentCurrentConnectionPanelProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,1fr)] lg:items-start">
      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {t("agents.currentConnection")}
        </div>
        <div className="flex items-center gap-3">
          <Select
            disabled={disabled || agent.connections.length === 0}
            value={agent.currentConnection?.id}
            onValueChange={onSwitch}
          >
            <SelectTrigger className="h-11 max-w-[20rem] rounded-xl">
              <SelectValue placeholder={t("support.noSavedSelection")} />
            </SelectTrigger>
            <SelectContent>
              {agent.connections.map((connection) => (
                <SelectItem
                  key={connection.id}
                  value={connection.id}
                  meta={(
                    <UsageIndicator
                      remainingPercent={connection.usage?.status === "available"
                        ? connection.usage.remainingPercent
                        : null}
                      showPercent={false}
                    />
                  )}
                >
                  {connection.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3 lg:justify-self-stretch">
        <CurrentUsageSummary agent={agent} t={t} />
      </div>
    </div>
  );
}

function CurrentUsageSummary({ agent, t }: { agent: DesktopAgentState; t: Translator }) {
  const hasCurrentSavedConnection = agent.connections.some((connection) => connection.isCurrent);
  const visibleUsage = hasCurrentSavedConnection ? agent.currentUsage : null;
  const visiblePlanLabel = hasCurrentSavedConnection
    ? (agent.currentUsage?.planLabel ?? agent.currentConnection?.endpointLabel ?? t("common.usage"))
    : t("common.usage");

  return (
    <UsagePanel
      className="px-1 py-1"
      framed={false}
      maxWindows={3}
      planLabel={visiblePlanLabel}
      showPlanLabel={Boolean(hasCurrentSavedConnection)}
      showRenewalAt={false}
      t={t}
      title={t("common.usage")}
      usage={visibleUsage}
    />
  );
}
