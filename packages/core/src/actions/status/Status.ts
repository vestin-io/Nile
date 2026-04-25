import type { AccessRegistry } from "../../models/access";
import type { EndpointFamily, EndpointProfile, EndpointProtocols, EndpointRegistry } from "../../models/endpoint";
import { EndpointShape } from "../../models/endpoint";
import type { AgentId } from "../../models/agent/Types";
import { AgentAdapterRegistry } from "../../runtime-local/AgentAdapterRegistry";
import type { DetectedAgentState, AgentLiveStateValidity } from "../../runtime-local/AgentAdapterTypes";

export type AgentStatusConnection = {
  id?: string;
  label: string;
  appliedAt?: string;
  endpointId?: string;
  endpointLabel: string;
  endpointFamily: EndpointFamily | "unknown";
  authMode: string;
};

export type AgentCurrentConnectionState = "none" | "saved" | "orphaned";

export type AgentStatusView = {
  agent: AgentId;
  currentConnection: AgentStatusConnection | null;
  currentConnectionState: AgentCurrentConnectionState;
  liveConnection: AgentStatusConnection | null;
  syncState:
    | "synced"
    | "new_connection_detected"
    | "invalid_live_state"
    | "unverified_live_state";
  liveIssues?: string[];
};

export class Status {
  constructor(
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    private readonly agentAdapterRegistry: AgentAdapterRegistry,
  ) {}

  get(agentId: AgentId): AgentStatusView {
    const detection = this.agentAdapterRegistry.get(agentId).detectAgentSelection();
    const currentConnection = this.resolveCurrentConnection(detection.agentSelection);
    const liveConnection = this.resolveLiveConnection(detection.detectedState);
    const payload: AgentStatusView = {
      agent: detection.agentSelection?.agentId ?? detection.detectedState.agentId,
      currentConnection: currentConnection.connection,
      currentConnectionState: currentConnection.state,
      liveConnection,
      syncState: this.resolveSyncState(detection.detectedState.validity),
    };

    if (detection.detectedState.issues.length > 0) {
      payload.liveIssues = detection.detectedState.issues;
    }

    return payload;
  }

  list(agentIds?: AgentId[]): AgentStatusView[] {
    const ids = agentIds ?? this.agentAdapterRegistry.listAgents();
    return ids.map((agentId) => this.get(agentId));
  }

  private resolveCurrentConnection(
    current: {
      agentId: string;
      connectionId: string;
      endpointId: string;
      accessId: string;
      appliedAt: string;
    } | null,
  ): {
    connection: AgentStatusConnection | null;
    state: AgentCurrentConnectionState;
  } {
    if (!current) {
      return {
        connection: null,
        state: "none",
      };
    }

    const access = this.accessRegistry.get(current.connectionId);
    if (!access) {
      const endpoint = this.endpointRegistry.get(current.endpointId);
      return {
        connection: {
          id: current.connectionId,
          label: current.connectionId,
          appliedAt: current.appliedAt,
          endpointId: current.endpointId,
          endpointLabel: endpoint?.label ?? current.endpointId,
          endpointFamily: "unknown",
          authMode: "unknown",
        },
        state: "orphaned",
      };
    }

    const endpoint = this.endpointRegistry.get(access.endpointId);
    if (!endpoint) {
      return {
        connection: {
          id: current.connectionId,
          label: access.label,
          appliedAt: current.appliedAt,
          endpointId: current.endpointId,
          endpointLabel: current.endpointId,
          endpointFamily: "unknown",
          authMode: access.authMode,
        },
        state: "orphaned",
      };
    }

    return {
      connection: {
        id: access.id,
        label: access.label,
        appliedAt: current.appliedAt,
        endpointId: endpoint.id,
        endpointLabel: endpoint.label,
        endpointFamily: detectedStateFamilyFromEndpoint(endpoint),
        authMode: access.authMode,
      },
      state: "saved",
    };
  }

  private resolveLiveConnection(
    detectedState: DetectedAgentState,
  ): AgentStatusConnection | null {
    if (detectedState.validity === "invalid_structure") {
      return null;
    }

    if (detectedState.matchedConnection) {
      const endpoint = this.endpointRegistry.get(detectedState.matchedConnection.endpointId);
      const access = this.accessRegistry.get(detectedState.matchedConnection.accessId);
      if (endpoint && access) {
        return {
          id: access.id,
          label: access.label,
          endpointId: endpoint.id,
          endpointLabel: endpoint.label,
          endpointFamily: detectedStateFamilyFromEndpoint(endpoint),
          authMode: access.authMode,
        };
      }
    }

    if (!detectedState.endpoint || !detectedState.access) {
      return null;
    }

    return {
      label: detectedState.access.labelHint,
      endpointLabel: detectedState.endpoint.labelHint,
      endpointFamily: detectedState.endpoint.endpointFamily,
      authMode: detectedState.access.authMode,
    };
  }

  private resolveSyncState(validity: AgentLiveStateValidity): AgentStatusView["syncState"] {
    if (validity === "invalid_structure" || validity === "invalid_semantics") {
      return "invalid_live_state";
    }
    if (validity === "valid_import_candidate") {
      return "new_connection_detected";
    }
    if (validity === "valid_unverified") {
      return "unverified_live_state";
    }
    return "synced";
  }
}

function detectedStateFamilyFromEndpoint(
  endpoint: { profile?: EndpointProfile; protocols: EndpointProtocols },
): EndpointFamily {
  return EndpointShape.readFamily(endpoint);
}
