import { useState } from "react";

import type { DesktopAgentState, DesktopOnboardingState } from "../../../state/Types";
import { AgentCard } from "./Card";
import type { AgentDetailTab } from "../detail/Page";
import type { Translator } from "../../shared/I18n";
import { AgentListToolbar } from "./Toolbar";

type AgentListViewProps = {
  agents: DesktopAgentState[];
  canConfigureAgent(agentId: DesktopAgentState["agentId"]): boolean;
  detectedSetups: DesktopOnboardingState;
  showQuickSetupEntry: boolean;
  t: Translator;
  onConfigureAgent(agentId: DesktopAgentState["agentId"]): void;
  onImport(agentId: DesktopAgentState["agentId"]): Promise<void>;
  onOpenQuickSetup(): void;
  onReorderAgents(
    draggedAgentId: DesktopAgentState["agentId"],
    targetAgentId: DesktopAgentState["agentId"],
  ): void;
  onOpenDetails(agentId: DesktopAgentState["agentId"], tab?: AgentDetailTab): void;
  onRefresh(): Promise<void>;
  onUpdateAgentConnectionModel(agentId: DesktopAgentState["agentId"], connectionId: string, modelId: string | null): Promise<void>;
  onSwitch(agentId: DesktopAgentState["agentId"], connectionId: string): Promise<void>;
};

export function AgentListView({
  agents,
  canConfigureAgent,
  detectedSetups,
  showQuickSetupEntry,
  t,
  onConfigureAgent,
  onImport,
  onOpenQuickSetup,
  onReorderAgents,
  onOpenDetails,
  onRefresh,
  onUpdateAgentConnectionModel,
  onSwitch,
}: AgentListViewProps) {
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [draggedAgentId, setDraggedAgentId] = useState<DesktopAgentState["agentId"] | null>(null);
  const [dropTargetAgentId, setDropTargetAgentId] = useState<DesktopAgentState["agentId"] | null>(null);
  const detectedSetupsByAgent = new Map(
    detectedSetups.items.map((item) => [item.agentId, item]),
  );

  return (
    <div className="space-y-4">
      <AgentListToolbar
        isEditingOrder={isEditingOrder}
        showQuickSetupEntry={showQuickSetupEntry}
        t={t}
        onOpenQuickSetup={onOpenQuickSetup}
        onRefresh={onRefresh}
        onToggleEdit={() => setIsEditingOrder((current) => !current)}
      />
      <div className="grid gap-4">
        {agents.map((agent) => (
          <AgentCard
            key={agent.agentId}
            agent={agent}
            canConfigure={canConfigureAgent(agent.agentId)}
            detectedSetup={detectedSetupsByAgent.get(agent.agentId) ?? null}
            draggedAgentId={draggedAgentId}
            dropTargetAgentId={dropTargetAgentId}
            isEditingOrder={isEditingOrder}
            t={t}
            onConfigure={onConfigureAgent}
            onDragEnd={() => {
              setDraggedAgentId(null);
              setDropTargetAgentId(null);
            }}
            onDragOver={(event) => {
              if (!isEditingOrder || !draggedAgentId || draggedAgentId === agent.agentId) {
                return;
              }
              event.preventDefault();
              setDropTargetAgentId(agent.agentId);
            }}
            onDragStart={() => {
              if (!isEditingOrder) {
                return;
              }
              setDraggedAgentId(agent.agentId);
              setDropTargetAgentId(agent.agentId);
            }}
            onDrop={(event) => {
              if (!isEditingOrder || !draggedAgentId || draggedAgentId === agent.agentId) {
                return;
              }
              event.preventDefault();
              onReorderAgents(draggedAgentId, agent.agentId);
              setDraggedAgentId(null);
              setDropTargetAgentId(null);
            }}
            onImport={onImport}
            onOpenDetails={onOpenDetails}
            onUpdateAgentConnectionModel={onUpdateAgentConnectionModel}
            onSwitch={onSwitch}
          />
        ))}
      </div>
    </div>
  );
}
