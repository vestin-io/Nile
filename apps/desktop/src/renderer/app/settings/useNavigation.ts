import { useEffect, useMemo, useState } from "react";

import { isAgentId, type AgentId } from "@nile/core/models/agent/types";

import type { SettingsState } from "../../shared/DesktopData";

export type PageId = "quick-setup" | "agents" | "connections" | "providers" | "settings" | "add-connection";
type MainPageId = Exclude<PageId, "add-connection">;

export type AddConnectionReturnTarget =
  | { kind: "quick-setup" }
  | { kind: "agents" }
  | { kind: "connections-detail" };

export type ReusedConnectionDialogState = {
  connectionId: string;
  target: AddConnectionReturnTarget;
} | null;

type UseSettingsNavigationOptions = {
  quickSetupDismissed: boolean;
  settingsState: SettingsState | null;
};

type SettingsNavigationState = {
  addConnectionReturnTarget: AddConnectionReturnTarget;
  addConnectionTargetAgentId: AgentId | null;
  currentPage: PageId;
  hasSavedConnections: boolean;
  openAddConnectionPage(agentId?: AgentId | Event | unknown): void;
  repairUsageConnectionId: string | null;
  reusedConnectionDialog: ReusedConnectionDialogState;
  selectedAgentDetailId: AgentId | null;
  selectedConnectionContextAgentId: AgentId | null;
  selectedConnectionId: string | null;
  setCurrentPage(page: PageId): void;
  setRepairUsageConnectionId(connectionId: string | null): void;
  setReusedConnectionDialog(state: ReusedConnectionDialogState): void;
  setSelectedAgentDetailId(agentId: AgentId | null): void;
  setSelectedConnectionContextAgentId(agentId: AgentId | null): void;
  setSelectedConnectionId(connectionId: string | null): void;
  showAgents: boolean;
  showConnections: boolean;
  showQuickSetupNav: boolean;
  visiblePage: PageId;
};

export function useSettingsNavigation({
  quickSetupDismissed,
  settingsState,
}: UseSettingsNavigationOptions): SettingsNavigationState {
  const [currentPage, setCurrentPage] = useState<PageId>("agents");
  const [appliedInitialOnboardingRoute, setAppliedInitialOnboardingRoute] = useState(false);
  const [addConnectionTargetAgentId, setAddConnectionTargetAgentId] = useState<AgentId | null>(null);
  const [addConnectionReturnTarget, setAddConnectionReturnTarget] = useState<AddConnectionReturnTarget>({
    kind: "connections-detail",
  });
  const [selectedAgentDetailId, setSelectedAgentDetailId] = useState<AgentId | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedConnectionContextAgentId, setSelectedConnectionContextAgentId] = useState<AgentId | null>(null);
  const [reusedConnectionDialog, setReusedConnectionDialog] = useState<ReusedConnectionDialogState>(null);
  const [repairUsageConnectionId, setRepairUsageConnectionId] = useState<string | null>(null);

  const hasSavedConnections = (settingsState?.connections.length ?? 0) > 0;
  const isQuickSetupPage = currentPage === "quick-setup";
  const showQuickSetupNav = isQuickSetupPage || !quickSetupDismissed || !hasSavedConnections;
  const showAgents = hasSavedConnections;
  const showConnections = hasSavedConnections;
  const repairUsageConnection =
    settingsState?.connections.find((connection) => connection.id === repairUsageConnectionId) ?? null;

  useEffect(() => {
    if (!settingsState || appliedInitialOnboardingRoute) {
      return;
    }

    if (!hasSavedConnections) {
      setCurrentPage("quick-setup");
      setAppliedInitialOnboardingRoute(true);
      return;
    }

    if (!quickSetupDismissed && currentPage === "agents") {
      setCurrentPage("quick-setup");
    }

    if (quickSetupDismissed && currentPage === "quick-setup") {
      setCurrentPage("connections");
    }

    setAppliedInitialOnboardingRoute(true);
  }, [appliedInitialOnboardingRoute, currentPage, hasSavedConnections, quickSetupDismissed, settingsState]);

  useEffect(() => {
    if (currentPage === "agents" && !showAgents) {
      setCurrentPage("quick-setup");
      return;
    }

    if (currentPage === "connections" && !showConnections) {
      setCurrentPage("quick-setup");
    }
  }, [currentPage, showAgents, showConnections]);

  const visiblePage: PageId = useMemo(() => {
    if (currentPage === "add-connection") {
      return "add-connection";
    }
    if (currentPage === "agents" && !showAgents) {
      return "quick-setup";
    }
    if (currentPage === "connections" && !showConnections) {
      return "quick-setup";
    }
    if (currentPage === "quick-setup" && !showQuickSetupNav && hasSavedConnections) {
      return "agents";
    }
    return currentPage;
  }, [currentPage, hasSavedConnections, showAgents, showConnections, showQuickSetupNav]);

  useEffect(() => {
    if (repairUsageConnectionId && !repairUsageConnection) {
      setRepairUsageConnectionId(null);
    }
  }, [repairUsageConnection, repairUsageConnectionId]);

  useEffect(() => {
    if (selectedConnectionId && !settingsState?.connections.find((connection) => connection.id === selectedConnectionId)) {
      setSelectedConnectionId(null);
      setSelectedConnectionContextAgentId(null);
    }
  }, [selectedConnectionId, settingsState]);

  useEffect(() => {
    if (currentPage !== "add-connection" && addConnectionTargetAgentId) {
      setAddConnectionTargetAgentId(null);
    }
  }, [addConnectionTargetAgentId, currentPage]);

  const openAddConnectionPage = (agentId?: AgentId | Event | unknown) => {
    setReusedConnectionDialog(null);
    const nextTargetAgentId = typeof agentId === "string" && isAgentId(agentId) ? agentId : null;
    setAddConnectionTargetAgentId(nextTargetAgentId);
    if (currentPage === "quick-setup") {
      setAddConnectionReturnTarget({ kind: "quick-setup" });
    } else if (currentPage === "agents") {
      setAddConnectionReturnTarget({ kind: "agents" });
    } else {
      setAddConnectionReturnTarget({ kind: "connections-detail" });
    }
    setCurrentPage("add-connection");
  };

  return {
    addConnectionReturnTarget,
    addConnectionTargetAgentId,
    currentPage,
    hasSavedConnections,
    openAddConnectionPage,
    repairUsageConnectionId,
    reusedConnectionDialog,
    selectedAgentDetailId,
    selectedConnectionContextAgentId,
    selectedConnectionId,
    setCurrentPage,
    setRepairUsageConnectionId,
    setReusedConnectionDialog,
    setSelectedAgentDetailId,
    setSelectedConnectionContextAgentId,
    setSelectedConnectionId,
    showAgents,
    showConnections,
    showQuickSetupNav,
    visiblePage,
  };
}

export function readReturnPage(target: AddConnectionReturnTarget): MainPageId {
  if (target.kind === "quick-setup") {
    return "quick-setup";
  }

  if (target.kind === "agents") {
    return "agents";
  }

  return "connections";
}

export function applyAddConnectionCompletionTarget(
  target: AddConnectionReturnTarget,
  connectionId: string,
  setCurrentPage: (page: PageId) => void,
  setSelectedConnectionId: (connectionId: string | null) => void,
): void {
  if (target.kind === "connections-detail") {
    setSelectedConnectionId(connectionId);
    setCurrentPage("connections");
    return;
  }

  setSelectedConnectionId(null);
  setCurrentPage(readReturnPage(target));
}
