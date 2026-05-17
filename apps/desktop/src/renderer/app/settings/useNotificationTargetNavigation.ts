import { useCallback, useEffect } from "react";

import type { AgentId } from "@nile/core/models/agent/definitions";

import type { DesktopNotificationTarget } from "../../../electron/notifications/contracts";

export type NotificationTargetNavigatorOptions = {
  onOpenAgents(agentId?: AgentId): void;
  onOpenConnections(connectionId?: string, agentId?: AgentId): void;
  onOpenNotifications(connectionId?: string, kind?: "all" | "alerts"): void;
  onOpenProfiles(profileId?: string): void;
  onOpenSettings(): void;
};

export function useNotificationTargetNavigation(options: NotificationTargetNavigatorOptions) {
  const {
    onOpenAgents,
    onOpenConnections,
    onOpenNotifications,
    onOpenProfiles,
    onOpenSettings,
  } = options;

  const openNotificationTarget = useCallback((target: DesktopNotificationTarget) => {
    if (target.page === "agents") {
      onOpenAgents(target.agentId);
      return;
    }

    if (target.page === "connections") {
      onOpenConnections(target.connectionId, target.agentId);
      return;
    }

    if (target.page === "profiles") {
      onOpenProfiles(target.profileId);
      return;
    }

    if (target.page === "notifications") {
      onOpenNotifications(target.connectionId, target.kind);
      return;
    }

    onOpenSettings();
  }, [onOpenAgents, onOpenConnections, onOpenNotifications, onOpenProfiles, onOpenSettings]);

  useEffect(() => {
    return window.nileDesktopEvents.onNotificationTarget(openNotificationTarget);
  }, [openNotificationTarget]);

  return { openNotificationTarget };
}
