import { formatAgentLabel as readAgentLabel, type AgentId } from "@nile/core/models/agent/types";
import { CONNECTION_APPLY_REQUIREMENTS } from "@nile/core/models/connection/requirements";
import type { SavedConnectionSummary } from "@nile/core/models/connection";

import type { DesktopConnection } from "../Types";
import type { DesktopUsageState } from "../UsageSummary";

export type SelectionDisplayOverride = {
  agentId: AgentId;
  connectionId: string | null;
};

export class DesktopConnectionListPresenter {
  buildConnections(
    savedConnections: SavedConnectionSummary[],
    currentConnectionId: string | null,
    usageByConnectionId?: Map<string, DesktopUsageState | null>,
    selectionOverride?: SelectionDisplayOverride,
    agentModelIdsByConnectionId?: Map<string, string | null>,
    agentId?: AgentId,
  ): DesktopConnection[] {
    const items: DesktopConnection[] = savedConnections.map((connection) => ({
      id: connection.id,
      label: connection.label,
      endpointUrl: connection.endpointUrl,
      endpointLabel: connection.endpointLabel,
      endpointFamily: (connection.endpointFamily ?? "unknown") as DesktopConnection["endpointFamily"],
      authMode: connection.authMode,
      apiKeySource: connection.apiKeySource,
      envKey: connection.envKey,
      isCurrent: currentConnectionId === connection.id,
      usage: usageByConnectionId?.get(connection.id) ?? null,
      ...(agentModelIdsByConnectionId ? { agentModelId: agentModelIdsByConnectionId.get(connection.id) ?? null } : {}),
      activeAlertCount: 0,
      enabledAgents: [...connection.enabledAgents],
      configurableAgents: [...connection.configurableAgents],
      selectedByAgents: this.resolveDisplayedSelectedAgents(connection, selectionOverride),
      ...(agentId ? {
        applyRequirements: CONNECTION_APPLY_REQUIREMENTS.read({
          agentId,
          authMode: connection.authMode,
          envKey: connection.envKey,
          selectedModelId: agentModelIdsByConnectionId?.get(connection.id) ?? null,
        }),
      } : {}),
    }));

    return items.sort((left, right) => {
      if (left.isCurrent !== right.isCurrent) {
        return left.isCurrent ? -1 : 1;
      }
      return left.label.localeCompare(right.label);
    });
  }

  createSelectionDisplayOverride(
    agentId: AgentId,
    currentConnectionId: string | null,
  ): SelectionDisplayOverride {
    return {
      agentId,
      connectionId: currentConnectionId,
    };
  }

  formatAgentLabel(agentId: AgentId): string {
    return readAgentLabel(agentId);
  }

  private resolveDisplayedSelectedAgents(
    connection: SavedConnectionSummary,
    selectionOverride?: SelectionDisplayOverride,
  ): AgentId[] {
    const selectedByAgents = new Set(connection.selectedByAgents as AgentId[]);
    if (!selectionOverride) {
      return [...selectedByAgents];
    }

    selectedByAgents.delete(selectionOverride.agentId);
    if (selectionOverride.connectionId === connection.id) {
      selectedByAgents.add(selectionOverride.agentId);
    }
    return [...selectedByAgents];
  }
}
