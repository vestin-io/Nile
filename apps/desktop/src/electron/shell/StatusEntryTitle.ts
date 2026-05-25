import type { AgentId } from "@nile/core/models/agent/definitions";

import type { DesktopStatusEntryState } from "../../state/Types";
import type { ConnectionQuotaMetricPreferences } from "../../state/ConnectionQuotaMetricPreferences";
import type { DesktopStatusEntryDisplayState } from "../state/StatusEntryDisplayStore";
import { DesktopStatusEntrySummary } from "./StatusEntrySummary";

export class DesktopStatusEntryTitle {
  static readSelectedAgentIds(
    state: DesktopStatusEntryState | null,
    preferences: DesktopStatusEntryDisplayState,
  ): AgentId[] {
    return DesktopStatusEntrySummary.readSelectedAgentIds(state, preferences);
  }

  static toggleSelectedAgentIds(
    state: DesktopStatusEntryState | null,
    preferences: DesktopStatusEntryDisplayState,
    agentId: AgentId,
  ): AgentId[] {
    return DesktopStatusEntrySummary.toggleSelectedAgentIds(state, preferences, agentId);
  }

  static format(
    state: DesktopStatusEntryState | null,
    preferences: DesktopStatusEntryDisplayState,
    connectionQuotaMetricPreferences: ConnectionQuotaMetricPreferences = {},
  ): string {
    return DesktopStatusEntrySummary.formatTickerTitle(state, preferences, connectionQuotaMetricPreferences);
  }
}
