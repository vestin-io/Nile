import { formatAgentLabel, type AgentAdapterLookup, type AgentDetectionResult, type AgentId } from "../../models/agent";
import type { AccessRegistry } from "../../models/access";
import {
  type AgentStatusConnection,
  type AgentStatusView,
  Status,
} from "./Status";
import type { ScanItem, ScanItemState, ScanLocalSetupsResult } from "./Result";

export class ScanLocalSetups {
  constructor(
    private readonly status: Status,
    private readonly accessRegistry: AccessRegistry,
    private readonly agentAdapterRegistry: AgentAdapterLookup,
  ) {}

  run(agentIds?: AgentId[]): ScanLocalSetupsResult {
    const ids = agentIds ?? this.agentAdapterRegistry.listAgents();
    const items = ids.map((agentId) => this.scanAgent(agentId));
    return {
      items,
      importableCount: items.filter((item) => item.importable).length,
    };
  }

  private scanAgent(agentId: AgentId): ScanItem {
    const detection = this.agentAdapterRegistry.get(agentId).detectAgentSelection();
    const status = this.status.get(agentId);
    const state = this.resolveState(detection, status);
    const liveConnection = status.liveConnection;
    const matchedConnection = detection.detectedState.matchedConnection
      ? this.accessRegistry.get(detection.detectedState.matchedConnection.connectionId)
      : null;

    return {
      scanId: agentId,
      agentId,
      sourceKind: "current_live_setup",
      title: this.resolveTitle(agentId, liveConnection),
      subtitle: this.resolveSubtitle(liveConnection, detection),
      state,
      importable: state === "new",
      defaultSelected: state === "new",
      matchedConnectionId: matchedConnection?.id,
      matchedConnectionLabel: matchedConnection?.label,
      issues: [...detection.detectedState.issues],
    };
  }

  private resolveState(
    detection: AgentDetectionResult,
    status: AgentStatusView,
  ): ScanItemState {
    if (detection.detectedState.validity === "valid_matched") {
      return "already_saved";
    }

    if (detection.detectedState.validity === "valid_import_candidate") {
      return "new";
    }

    if (!status.liveConnection && detection.detectedState.issues.length === 0) {
      return "unavailable";
    }

    return "invalid";
  }

  private resolveTitle(agentId: AgentId, liveConnection: AgentStatusConnection | null): string {
    if (liveConnection) {
      return `${formatAgentLabel(agentId)} · ${liveConnection.label}`;
    }
    return `${formatAgentLabel(agentId)} · No local setup`;
  }

  private resolveSubtitle(
    liveConnection: AgentStatusConnection | null,
    detection: AgentDetectionResult,
  ): string {
    if (liveConnection) {
      return `${liveConnection.endpointLabel} • ${liveConnection.authMode}`;
    }

    const firstIssue = detection.detectedState.issues[0];
    return firstIssue ?? "No readable local setup detected";
  }
}
