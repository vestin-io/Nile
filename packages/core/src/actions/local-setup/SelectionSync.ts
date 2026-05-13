import { AGENT_CAPABILITIES, type AgentAdapterLookup, type AgentDetectionResult, type AgentId } from "../../models/agent";
import { AgentSelection } from "../../models/selection/Selection";

export class SelectionSync {
  constructor(
    private readonly agentSelection: AgentSelection,
    private readonly agentAdapterRegistry: AgentAdapterLookup,
  ) {}

  run(agentIds?: AgentId[]): Map<AgentId, AgentDetectionResult> {
    const ids = agentIds ?? this.agentAdapterRegistry.listAgents();
    const detections = new Map<AgentId, AgentDetectionResult>();
    for (const agentId of ids) {
      const detection = this.agentAdapterRegistry.get(agentId).detectAgentSelection();
      detections.set(agentId, detection);
      this.syncMatchedSelection(agentId, detection);
    }
    return detections;
  }

  private syncMatchedSelection(
    agentId: AgentId,
    detection: AgentDetectionResult,
  ): void {
    if (!AGENT_CAPABILITIES.read(agentId).autoSyncMatchedSelection) {
      return;
    }
    if (detection.detectedState.validity !== "valid_matched" || !detection.detectedState.matchedConnection) {
      return;
    }

    const matchedConnectionId = detection.detectedState.matchedConnection.accessId;
    const currentSelection = this.agentSelection.get(agentId);
    if (currentSelection?.connectionId === matchedConnectionId) {
      return;
    }

    this.agentSelection.setApplied(agentId, matchedConnectionId);
  }
}
