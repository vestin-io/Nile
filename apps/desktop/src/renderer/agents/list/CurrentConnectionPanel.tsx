import { LoaderCircle } from "lucide-react";

import type { DesktopAgentState } from "../../../state/Types";
import type { Translator } from "../../shared/I18n";
import { UsagePanel } from "../../shared/UsagePanel";
import { UsageIndicator } from "../../shared/UsageIndicator";
import { useConnectionQuotaMetricPreferences } from "../../shared/useConnectionQuotaMetricPreferences";
import { resolveDesktopUsageSummary } from "../../../state/UsageSummary";
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
  switchingConnectionId: string | null;
  t: Translator;
  onSwitch(connectionId: string): void;
};

export function AgentCurrentConnectionPanel({
  agent,
  disabled,
  switchingConnectionId,
  t,
  onSwitch,
}: AgentCurrentConnectionPanelProps) {
  const quotaMetricPreferences = useConnectionQuotaMetricPreferences();
  const isSwitchingConnection = switchingConnectionId !== null;
  const switchingConnection = switchingConnectionId
    ? (agent.connections.find((connection) => connection.id === switchingConnectionId) ?? null)
    : null;
  const visibleConnectionId = switchingConnectionId ?? agent.currentConnection?.id;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,1fr)] lg:items-start">
      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {t("agents.currentConnection")}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-[20rem]">
            <Select
              disabled={disabled || isSwitchingConnection || agent.connections.length === 0}
              value={visibleConnectionId}
              onValueChange={onSwitch}
            >
              <SelectTrigger
                className={[
                  "relative h-11 w-full overflow-hidden rounded-xl transition-colors duration-200",
                  isSwitchingConnection
                    ? "border-ring/50 bg-muted/30 after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:w-20 after:animate-pulse after:bg-gradient-to-r after:from-transparent after:via-foreground/10 after:to-transparent"
                    : "",
                ].filter(Boolean).join(" ")}
                icon={isSwitchingConnection ? <LoaderCircle className="h-4 w-4 animate-spin opacity-70" /> : undefined}
              >
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
                          ? (resolveDesktopUsageSummary(
                              connection.usage,
                              quotaMetricPreferences.readPreference(connection.id),
                            )?.remainingPercent ?? connection.usage.remainingPercent)
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
        {isSwitchingConnection ? (
          <div
            className="text-sm text-muted-foreground"
            aria-live="polite"
          >
            <span>
              {t("common.switching")}
              {switchingConnection ? ` · ${switchingConnection.label}` : ""}
            </span>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 lg:justify-self-stretch">
        <CurrentUsageSummary
          agent={agent}
          isSwitchingConnection={isSwitchingConnection}
          t={t}
        />
      </div>
    </div>
  );
}

function CurrentUsageSummary({
  agent,
  isSwitchingConnection,
  t,
}: {
  agent: DesktopAgentState;
  isSwitchingConnection: boolean;
  t: Translator;
}) {
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
      loading={isSwitchingConnection}
      planLabel={visiblePlanLabel}
      showPlanLabel={Boolean(hasCurrentSavedConnection)}
      showRenewalAt={false}
      t={t}
      title={t("common.usage")}
      usage={visibleUsage}
    />
  );
}
