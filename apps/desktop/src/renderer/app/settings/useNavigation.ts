import { useEffect, useMemo, useState } from "react";

import { isAgentId, type AgentId } from "@nile/core/models/agent/definitions";

import type { SettingsState } from "../../shared/DesktopData";

export type PageId =
  | "quick-setup"
  | "agents"
  | "connections"
  | "profiles"
  | "providers"
  | "settings"
  | "notifications"
  | "add-connection";
type MainPageId = Exclude<PageId, "add-connection">;
export type NotificationHistoryKindFilter = "all" | "alerts";
export type NotificationHistoryFilter = {
  connectionId: string | null;
  kind: NotificationHistoryKindFilter;
};

export type AddConnectionReturnTarget =
  | { kind: "quick-setup" }
  | { kind: "agents" }
  | { kind: "connections-detail" };

export type ReusedConnectionDialogState = {
  connectionId: string;
  target: AddConnectionReturnTarget;
} | null;

type UseSettingsNavigationOptions = {
  profileFeatureEnabled: boolean;
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
  notificationHistoryFilter: NotificationHistoryFilter;
  selectedAgentDetailId: AgentId | null;
  selectedConnectionContextAgentId: AgentId | null;
  selectedConnectionId: string | null;
  selectedProfileId: string | null;
  setCurrentPage(page: PageId): void;
  setNotificationHistoryFilter(filter: NotificationHistoryFilter): void;
  setRepairUsageConnectionId(connectionId: string | null): void;
  setReusedConnectionDialog(state: ReusedConnectionDialogState): void;
  setSelectedAgentDetailId(agentId: AgentId | null): void;
  setSelectedConnectionContextAgentId(agentId: AgentId | null): void;
  setSelectedConnectionId(connectionId: string | null): void;
  setSelectedProfileId(profileId: string | null): void;
  showAgents: boolean;
  showConnections: boolean;
  showProfiles: boolean;
  showQuickSetupNav: boolean;
  visiblePage: PageId;
};

export function useSettingsNavigation({
  profileFeatureEnabled,
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
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [notificationHistoryFilter, setNotificationHistoryFilter] = useState<NotificationHistoryFilter>({
    connectionId: null,
    kind: "all",
  });
  const [reusedConnectionDialog, setReusedConnectionDialog] = useState<ReusedConnectionDialogState>(null);
  const [repairUsageConnectionId, setRepairUsageConnectionId] = useState<string | null>(null);

  const hasSavedConnections = (settingsState?.connections.length ?? 0) > 0;
  const isQuickSetupPage = currentPage === "quick-setup";
  const showQuickSetupNav = isQuickSetupPage || !quickSetupDismissed || !hasSavedConnections;
  const showAgents = hasSavedConnections;
  const showConnections = hasSavedConnections;
  const showProfiles = profileFeatureEnabled
    && (settingsState?.agents.filter((agent) => agent.connections.length > 0).length ?? 0) >= 2;
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
      return;
    }

    if (currentPage === "profiles" && !showProfiles) {
      setCurrentPage(hasSavedConnections ? "agents" : "quick-setup");
    }
  }, [currentPage, hasSavedConnections, showAgents, showConnections, showProfiles]);

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
    if (currentPage === "profiles" && !showProfiles) {
      return hasSavedConnections ? "agents" : "quick-setup";
    }
    if (currentPage === "quick-setup" && !showQuickSetupNav && hasSavedConnections) {
      return "agents";
    }
    return currentPage;
  }, [currentPage, hasSavedConnections, showAgents, showConnections, showProfiles, showQuickSetupNav]);

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

  useEffect(() => {
    if (!showProfiles && selectedProfileId) {
      setSelectedProfileId(null);
    }
  }, [selectedProfileId, showProfiles]);

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
    notificationHistoryFilter,
    repairUsageConnectionId,
    reusedConnectionDialog,
    selectedAgentDetailId,
    selectedConnectionContextAgentId,
    selectedConnectionId,
    selectedProfileId,
    setCurrentPage,
    setNotificationHistoryFilter,
    setRepairUsageConnectionId,
    setReusedConnectionDialog,
    setSelectedAgentDetailId,
    setSelectedConnectionContextAgentId,
    setSelectedConnectionId,
    setSelectedProfileId,
    showAgents,
    showConnections,
    showProfiles,
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
