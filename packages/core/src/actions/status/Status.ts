import type { AccessRecord, AccessRegistry } from "../../models/access";
import type {
  EndpointFamily,
  EndpointProfile,
  EndpointProtocols,
  EndpointRecord,
  EndpointRegistry,
} from "../../models/endpoint";
import { EndpointShape } from "../../models/endpoint";
import type {
  AgentAdapterLookup,
  AgentId,
  DetectedAgentState,
  AgentLiveStateValidity,
} from "../../models/agent";

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
    private readonly agentAdapterRegistry: AgentAdapterLookup,
  ) {}

  get(agentId: AgentId): AgentStatusView {
    return this.readStatus(agentId);
  }

  list(agentIds?: AgentId[]): AgentStatusView[] {
    const ids = agentIds ?? this.agentAdapterRegistry.listAgents();
    const accessById = new Map(this.accessRegistry.list().map((access) => [access.id, access]));
    const endpointById = new Map(this.endpointRegistry.list().map((endpoint) => [endpoint.id, endpoint]));
    return ids.map((agentId) => this.readStatus(agentId, accessById, endpointById));
  }

  private readStatus(
    agentId: AgentId,
    accessById?: Map<string, AccessRecord>,
    endpointById?: Map<string, EndpointRecord>,
  ): AgentStatusView {
    const detection = this.agentAdapterRegistry.get(agentId).detectAgentSelection();
    const currentConnection = this.resolveCurrentConnection(
      detection.agentSelection,
      accessById,
      endpointById,
    );
    const liveConnection = this.resolveLiveConnection(
      detection.detectedState,
      accessById,
      endpointById,
    );
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

  private resolveCurrentConnection(
    current: {
      agentId: string;
      connectionId: string;
      endpointId: string;
      accessId: string;
      appliedAt: string;
    } | null,
    accessById?: Map<string, AccessRecord>,
    endpointById?: Map<string, EndpointRecord>,
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

    const access = accessById?.get(current.connectionId) ?? this.accessRegistry.get(current.connectionId);
    if (!access) {
      const endpoint = endpointById?.get(current.endpointId) ?? this.endpointRegistry.get(current.endpointId);
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

    const endpoint = endpointById?.get(access.endpointId) ?? this.endpointRegistry.get(access.endpointId);
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
    accessById?: Map<string, AccessRecord>,
    endpointById?: Map<string, EndpointRecord>,
  ): AgentStatusConnection | null {
    if (detectedState.validity === "invalid_structure") {
      return null;
    }

    if (detectedState.matchedConnection) {
      const endpoint = endpointById?.get(detectedState.matchedConnection.endpointId)
        ?? this.endpointRegistry.get(detectedState.matchedConnection.endpointId);
      const access = accessById?.get(detectedState.matchedConnection.accessId)
        ?? this.accessRegistry.get(detectedState.matchedConnection.accessId);
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
