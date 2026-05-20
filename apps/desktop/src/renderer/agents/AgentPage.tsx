import { useEffect, useMemo } from "react";

import type { AgentId } from "@nile/core/models/agent/definitions";

import type {
  DesktopAdvancedState,
  DesktopAgentState,
  DesktopOnboardingItem,
  DesktopOnboardingState,
  HistoryState,
} from "../../state/Types";
import { AgentDetailPage } from "./detail/Page";
import type { AgentDetailTab } from "./detail/Page";
import type { Translator } from "../shared/I18n";
import { AgentListView } from "./list/View";

type AgentPageProps = {
  agents: DesktopAgentState[];
  agentHomes: DesktopAdvancedState["agentHomes"];
  agentOrder: AgentId[];
  canConfigureAgent(agentId: DesktopAgentState["agentId"]): boolean;
  detectedSetups: DesktopOnboardingState;
  history: HistoryState;
  selectedDetailAgentId: AgentId | null;
  selectedDetailTab: AgentDetailTab;
  showQuickSetupEntry: boolean;
  t: Translator;
  onAgentOrderChange(agentOrder: AgentId[]): void;
  onAgentHomeSave(agentId: AgentId, path: string | null): Promise<void>;
  onAgentRuntimeCommandSave(agentId: AgentId, path: string | null): Promise<void>;
  onConfigureAgent(agentId: DesktopAgentState["agentId"]): void;
  onImport(agentId: DesktopAgentState["agentId"]): Promise<void>;
  onOpenQuickSetup(): void;
  onOpenAddPage(agentId: DesktopAgentState["agentId"]): void;
  onOpenConnection(connectionId: string, agentId: DesktopAgentState["agentId"]): void;
  onRefresh(): Promise<void>;
  onRollback(agentId: DesktopAgentState["agentId"]): Promise<void>;
  onUpdateAgentConnectionModel(agentId: DesktopAgentState["agentId"], connectionId: string, modelId: string | null): Promise<void>;
  onSelectedDetailAgentIdChange(agentId: AgentId | null): void;
  onSelectedDetailTabChange(tab: AgentDetailTab): void;
  onSwitch(agentId: DesktopAgentState["agentId"], connectionId: string): Promise<void>;
};

export function AgentPage({
  agents,
  agentHomes,
  agentOrder,
  canConfigureAgent,
  detectedSetups,
  history,
  selectedDetailAgentId,
  selectedDetailTab,
  showQuickSetupEntry,
  t,
  onAgentOrderChange,
  onAgentHomeSave,
  onAgentRuntimeCommandSave,
  onConfigureAgent,
  onImport,
  onOpenQuickSetup,
  onOpenAddPage,
  onOpenConnection,
  onRefresh,
  onRollback,
  onUpdateAgentConnectionModel,
  onSelectedDetailAgentIdChange,
  onSelectedDetailTabChange,
  onSwitch,
}: AgentPageProps) {
  const fallbackOrderIndex = useMemo(
    () => new Map(agents.map((agent, index) => [agent.agentId, index])),
    [agents],
  );
  const orderedAgents = useMemo(
    () => [...agents].sort((left, right) =>
      (agentOrder.indexOf(left.agentId) >= 0 ? agentOrder.indexOf(left.agentId) : (fallbackOrderIndex.get(left.agentId) ?? Number.MAX_SAFE_INTEGER))
      - (agentOrder.indexOf(right.agentId) >= 0 ? agentOrder.indexOf(right.agentId) : (fallbackOrderIndex.get(right.agentId) ?? Number.MAX_SAFE_INTEGER))),
    [agentOrder, agents, fallbackOrderIndex],
  );

  useEffect(() => {
    if (!selectedDetailAgentId) {
      return;
    }

    if (!orderedAgents.find((agent) => agent.agentId === selectedDetailAgentId)) {
      onSelectedDetailAgentIdChange(null);
    }
  }, [onSelectedDetailAgentIdChange, orderedAgents, selectedDetailAgentId]);

  if (orderedAgents.length === 0) {
    return null;
  }

  if (!selectedDetailAgentId) {
    return (
      <AgentListView
        agents={orderedAgents}
        canConfigureAgent={canConfigureAgent}
        detectedSetups={detectedSetups}
        showQuickSetupEntry={showQuickSetupEntry}
        t={t}
        onConfigureAgent={onConfigureAgent}
        onImport={onImport}
        onOpenQuickSetup={onOpenQuickSetup}
        onReorderAgents={(draggedAgentId, targetAgentId) => {
          const currentOrder = [...agentOrder];
          const draggedIndex = currentOrder.indexOf(draggedAgentId);
          const targetIndex = currentOrder.indexOf(targetAgentId);
          if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) {
            return;
          }
          const [moved] = currentOrder.splice(draggedIndex, 1);
          currentOrder.splice(targetIndex, 0, moved);
          onAgentOrderChange(currentOrder);
        }}
        onOpenDetails={(agentId, tab = "connections") => {
          onSelectedDetailTabChange(tab);
          onSelectedDetailAgentIdChange(agentId);
        }}
        onRefresh={onRefresh}
        onUpdateAgentConnectionModel={onUpdateAgentConnectionModel}
        onSwitch={onSwitch}
      />
    );
  }

  const agent = orderedAgents.find((entry) => entry.agentId === selectedDetailAgentId);
  if (!agent) {
    return null;
  }
  const detectedSetupsByAgent = new Map<AgentId, DesktopOnboardingItem>(
    detectedSetups.items.map((item) => [item.agentId, item]),
  );
  const agentHome = agentHomes.find((entry) => entry.agentId === agent.agentId);
  if (!agentHome) {
    return null;
  }

  return (
    <AgentDetailPage
      agent={agent}
      agentHome={agentHome}
      canConfigure={canConfigureAgent(agent.agentId)}
      detectedSetup={detectedSetupsByAgent.get(agent.agentId) ?? null}
      entries={history.entries.filter((entry) => entry.agentId === agent.agentId)}
      activeTab={selectedDetailTab}
      t={t}
      onBack={() => onSelectedDetailAgentIdChange(null)}
      onTabChange={onSelectedDetailTabChange}
      onAgentHomeSave={onAgentHomeSave}
      onAgentRuntimeCommandSave={onAgentRuntimeCommandSave}
      onOpenAddPage={onOpenAddPage}
      onOpenConnection={(connectionId) => onOpenConnection(connectionId, agent.agentId)}
      onRefresh={onRefresh}
      onRollback={onRollback}
      onImport={onImport}
      onUpdateAgentConnectionModel={onUpdateAgentConnectionModel}
      onSwitch={onSwitch}
    />
  );
}
