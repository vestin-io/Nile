import type { AgentId } from "@nile/core/models/agent";

export type DesktopNotificationTarget =
  | { page: "settings" }
  | { page: "profiles"; profileId?: string }
  | { page: "connections"; connectionId?: string; agentId?: AgentId }
  | { page: "agents"; agentId?: AgentId }
  | {
    page: "notifications";
    connectionId?: string;
    kind?: "all" | "alerts";
  };

export type DesktopNotificationHistoryFilterInput = {
  connectionId?: string | null;
  kind?: "all" | "alerts";
  limit?: number;
};
