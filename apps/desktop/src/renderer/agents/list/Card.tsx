import type { DragEventHandler } from "react";
import { GripVertical } from "lucide-react";

import type { DesktopAgentState, DesktopOnboardingItem } from "../../../state/Types";
import { AgentCardHeader } from "../AgentCardHeader";
import type { Translator } from "../../shared/I18n";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { TextButton } from "../../ui/text-button";
import type { AgentDetailTab } from "../detail/Page";
import { AgentConnectionModelDialog } from "../detail/ModelEditor";
import { AgentCurrentConnectionPanel } from "./CurrentConnectionPanel";
import { AgentLocalSetupSection } from "./LocalSetupSection";
import { useAgentConnectionSwitchFlow } from "../useConnectionSwitchFlow";
import { LOCAL_SETUP_PRESENTATION } from "../../shared/LocalSetup";

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
  onUpdateAgentConnectionModel(agentId: DesktopAgentState["agentId"], connectionId: string, modelId: string | null): Promise<void>;
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
  onUpdateAgentConnectionModel,
  onSwitch,
}: AgentCardProps) {
  const flow = useAgentConnectionSwitchFlow({
    agent,
    t,
    onSwitch,
    onUpdateAgentConnectionModel,
  });

  const showDetectedSetup = shouldShowDetectedSetup(detectedSetup);
  const issueLink = readIssueLink(agent, t);
  const visibleDetectedSetup = showDetectedSetup ? detectedSetup : null;

  return (
    <>
      <AgentConnectionModelDialog
        agentId={agent.agentId}
        agentLabel={agent.agentLabel}
        connection={flow.editingConnection}
        error={flow.modelError}
        isSaving={flow.isSavingModel}
        mode="switch"
        modelId={flow.draftModelId}
        t={t}
        onClear={flow.clearModel}
        onModelIdChange={flow.setDraftModelId}
        onOpenChange={(open) => {
          if (!open) {
            flow.closeModelEditor();
          }
        }}
        onSubmit={flow.saveModel}
      />
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

              {visibleDetectedSetup ? (
                <AgentLocalSetupSection
                  agent={agent}
                  canConfigure={canConfigure}
                  detectedSetup={visibleDetectedSetup}
                  t={t}
                  onConfigure={onConfigure}
                  onImport={onImport}
                />
              ) : null}

              {!showDetectedSetup ? (
                <AgentCurrentConnectionPanel
                  agent={agent}
                  disabled={isEditingOrder}
                  t={t}
                  onSwitch={(connectionId) => {
                    void flow.switchConnection(connectionId).catch(() => undefined);
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
      </Card>
    </>
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
  detectedSetup: DesktopOnboardingItem | null,
): boolean {
  return LOCAL_SETUP_PRESENTATION.shouldShowDetectedSetup(detectedSetup);
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
