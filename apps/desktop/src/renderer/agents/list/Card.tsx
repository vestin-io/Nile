import type { DragEventHandler } from "react";
import { GripVertical } from "lucide-react";

import type { DesktopAgentState, DesktopOnboardingItem } from "../../../state/Types";
import { AgentCardHeader } from "../AgentCardHeader";
import { DetectedSetupSection } from "../../quick-setup/DetectedSetup";
import type { Translator } from "../../shared/I18n";
import { UsagePanel } from "../../shared/UsagePanel";
import { UsageIndicator } from "../../shared/UsageIndicator";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { TextButton } from "../../ui/text-button";
import type { AgentDetailTab } from "../detail/Page";

type AgentCardProps = {
  agent: DesktopAgentState;
  canConfigure: boolean;
  detectedSetup: DesktopOnboardingItem | null;
  draggedAgentId: DesktopAgentState["agentId"] | null;
  dropTargetAgentId: DesktopAgentState["agentId"] | null;
  isEditingOrder: boolean;
  t: Translator;
  onConfigure(agentId: DesktopAgentState["agentId"]): void;
  onDragEnd: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDragStart: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  onImport(agentId: DesktopAgentState["agentId"]): Promise<void>;
  onOpenDetails(agentId: DesktopAgentState["agentId"], tab?: AgentDetailTab): void;
  onSwitch(agentId: DesktopAgentState["agentId"], connectionId: string): Promise<void>;
};

export function AgentCard({
  agent,
  canConfigure,
  detectedSetup,
  draggedAgentId,
  dropTargetAgentId,
  isEditingOrder,
  t,
  onConfigure,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onImport,
  onOpenDetails,
  onSwitch,
}: AgentCardProps) {
  const hasCurrentSavedConnection = agent.connections.some((connection) => connection.isCurrent);
  const showDetectedSetup = shouldShowDetectedSetup(agent, detectedSetup);
  const savedConnectionLabel = agent.currentConnection?.label ?? t("support.noSavedSelection");
  const issueLink = readIssueLink(agent, t);

  return (
    <Card
      className={[
        "rounded-2xl",
        isEditingOrder ? "cursor-move select-none" : "",
        draggedAgentId === agent.agentId ? "opacity-60" : "",
        dropTargetAgentId === agent.agentId ? "ring-1 ring-ring" : "",
      ].filter(Boolean).join(" ")}
      draggable={isEditingOrder}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDrop={onDrop}
    >
      <div className="flex">
        {isEditingOrder ? <DragHandle /> : null}
        <div className="min-w-0 flex-1 px-5 py-5 sm:px-6">
          <div className="space-y-5">
            <AgentCardHeader
              agent={agent}
              subtitle={t("agents.connectionCount", { count: agent.connections.length })}
              trailing={isEditingOrder ? (
                <div className="pt-1 text-sm text-muted-foreground text-right">
                  {t("common.dragToReorder")}
                </div>
              ) : (
                <TextButton
                  underline
                  onClick={() => onOpenDetails(agent.agentId, issueLink ? "home" : "connections")}
                  className={issueLink?.toneClassName}
                >
                  {issueLink?.label ?? t("common.more")}
                </TextButton>
              )}
            />

            {showDetectedSetup ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {t("agents.localSetup")}
                  </div>
                  {hasCurrentSavedConnection ? (
                    <div className="text-sm text-muted-foreground">
                      {t("agents.savedInNile", { connection: savedConnectionLabel })}
                    </div>
                  ) : null}
                </div>
                <DetectedSetupSection
                  agentId={agent.agentId}
                  canConfigure={canConfigure}
                  confirmed={false}
                  detectedSetup={detectedSetup}
                  t={t}
                  onConfigure={onConfigure}
                  onSave={onImport}
                />
              </div>
            ) : null}

            {!showDetectedSetup ? (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,1fr)] lg:items-start">
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {t("agents.currentConnection")}
                  </div>
                  <div className="flex items-center gap-3">
                    <Select
                      disabled={isEditingOrder || agent.connections.length === 0}
                      value={agent.currentConnection?.id}
                      onValueChange={(connectionId) => {
                        void onSwitch(agent.agentId, connectionId).catch(() => undefined);
                      }}
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
                  <UsageSummary agent={agent} t={t} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

function readIssueLink(
  agent: DesktopAgentState,
  t: Translator,
): { label: string; toneClassName: string } | null {
  const issues = agent.liveIssues ?? [];
  if (issues.length === 0) {
    return null;
  }

  const requiresConfig = issues.some((issue) => /^OpenClaw config not found at .+$/.test(issue));
  if (requiresConfig) {
    return {
      label: t("common.needsConfiguration"),
      toneClassName: "text-amber-600 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-200",
    };
  }

  return {
    label: t("common.configurationError"),
    toneClassName: "text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200",
  };
}

function shouldShowDetectedSetup(
  agent: DesktopAgentState,
  detectedSetup: DesktopOnboardingItem | null,
): boolean {
  if (!detectedSetup || detectedSetup.state === "already_saved") {
    return false;
  }

  if (detectedSetup.state === "new") {
    return true;
  }

  return agent.currentConnectionState === "none" && agent.connections.length === 0;
}

function UsageSummary({ agent, t }: { agent: DesktopAgentState; t: Translator }) {
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

function DragHandle() {
  return (
    <div className="flex w-12 shrink-0 items-stretch justify-center border-r bg-muted/20 text-muted-foreground">
      <div className="flex items-center justify-center">
        <GripVertical className="h-4 w-4" />
      </div>
    </div>
  );
}
