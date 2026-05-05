import { useEffect, useMemo } from "react";

import type { AgentId } from "@nile/core/models/agent/types";

import type {
  DesktopAdvancedState,
  DesktopAgentState,
  DesktopOnboardingState,
  HistoryState,
} from "../../state/Types";
import { AgentDetailPage } from "./detail/Page";
import type { AgentDetailTab } from "./detail/Page";
import type { Translator } from "../shared/I18n";
import { AgentListView } from "./list/View";

const AGENT_LIST_ORDER: AgentId[] = ["codex", "claude", "cursor", "openclaw"];
const AGENT_LIST_ORDER_INDEX = new Map(
  AGENT_LIST_ORDER.map((agentId, index) => [agentId, index]),
);

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
  onConfigureAgent(agentId: DesktopAgentState["agentId"]): void;
  onImport(agentId: DesktopAgentState["agentId"]): Promise<void>;
  onOpenQuickSetup(): void;
  onOpenAddPage(agentId: DesktopAgentState["agentId"]): void;
  onOpenConnection(connectionId: string, agentId: DesktopAgentState["agentId"]): void;
  onRefresh(): Promise<void>;
  onRollback(agentId: DesktopAgentState["agentId"]): Promise<void>;
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
  onConfigureAgent,
  onImport,
  onOpenQuickSetup,
  onOpenAddPage,
  onOpenConnection,
  onRefresh,
  onRollback,
  onSelectedDetailAgentIdChange,
  onSelectedDetailTabChange,
  onSwitch,
}: AgentPageProps) {
  const orderedAgents = useMemo(
    () => [...agents].sort((left, right) =>
      (agentOrder.indexOf(left.agentId) >= 0 ? agentOrder.indexOf(left.agentId) : (AGENT_LIST_ORDER_INDEX.get(left.agentId) ?? Number.MAX_SAFE_INTEGER))
      - (agentOrder.indexOf(right.agentId) >= 0 ? agentOrder.indexOf(right.agentId) : (AGENT_LIST_ORDER_INDEX.get(right.agentId) ?? Number.MAX_SAFE_INTEGER))),
    [agentOrder, agents],
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
        onSwitch={onSwitch}
      />
    );
  }

  const agent = orderedAgents.find((entry) => entry.agentId === selectedDetailAgentId);
  if (!agent) {
    return null;
  }
  const agentHome = agentHomes.find((entry) => entry.agentId === agent.agentId);
  if (!agentHome) {
    return null;
  }

  return (
    <AgentDetailPage
      agent={agent}
      agentHomePath={agentHome.path}
      defaultAgentHomePath={agentHome.defaultPath}
      entries={history.entries.filter((entry) => entry.agentId === agent.agentId)}
      activeTab={selectedDetailTab}
      t={t}
      onBack={() => onSelectedDetailAgentIdChange(null)}
      onTabChange={onSelectedDetailTabChange}
      onAgentHomeSave={onAgentHomeSave}
      onOpenAddPage={onOpenAddPage}
      onOpenConnection={(connectionId) => onOpenConnection(connectionId, agent.agentId)}
      onRefresh={onRefresh}
      onRollback={onRollback}
      onSwitch={onSwitch}
    />
  );
}
