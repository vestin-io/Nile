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
  AgentDetectionResult,
  DetectedAgentState,
  AgentLiveStateValidity,
} from "../../models/agent";
import {
  AGENT_SETUP_RECONCILIATION,
  type AgentSetupReconciliation,
} from "./Reconciliation";

export type AgentStatusConnection = {
  id?: string;
  label: string;
  appliedAt?: string;
  endpointId?: string;
  endpointLabel: string;
  endpointFamily: EndpointFamily | "unknown";
  authMode: string;
  modelId?: string;
};

export type AgentCurrentConnectionState = "none" | "saved" | "orphaned";

export type AgentStatusView = {
  agent: AgentId;
  currentConnection: AgentStatusConnection | null;
  currentConnectionState: AgentCurrentConnectionState;
  liveConnection: AgentStatusConnection | null;
  reconciliation: AgentSetupReconciliation;
  liveIssues?: string[];
};

export class Status {
  constructor(
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    private readonly agentAdapterRegistry: AgentAdapterLookup,
  ) {}

  get(agentId: AgentId, detection?: AgentDetectionResult): AgentStatusView {
    return this.readStatus(agentId, undefined, undefined, detection);
  }

  list(
    agentIds?: AgentId[],
    detections?: Map<AgentId, AgentDetectionResult>,
  ): AgentStatusView[] {
    const ids = agentIds ?? this.agentAdapterRegistry.listAgents();
    const accessById = new Map(this.accessRegistry.list().map((access) => [access.id, access]));
    const endpointById = new Map(this.endpointRegistry.list().map((endpoint) => [endpoint.id, endpoint]));
    return ids.map((agentId) => this.readStatus(agentId, accessById, endpointById, detections?.get(agentId)));
  }

  private readStatus(
    agentId: AgentId,
    accessById?: Map<string, AccessRecord>,
    endpointById?: Map<string, EndpointRecord>,
    detection?: AgentDetectionResult,
  ): AgentStatusView {
    const resolvedDetection = detection ?? this.agentAdapterRegistry.get(agentId).detectAgentSelection();
    const currentConnection = this.resolveCurrentConnection(
      resolvedDetection.agentSelection,
      accessById,
      endpointById,
    );
    const liveConnection = this.resolveLiveConnection(
      resolvedDetection.detectedState,
      accessById,
      endpointById,
    );
    const reconciliation = AGENT_SETUP_RECONCILIATION.read(resolvedDetection);
    const payload: AgentStatusView = {
      agent: resolvedDetection.agentSelection?.agentId ?? resolvedDetection.detectedState.agentId,
      currentConnection: currentConnection.connection,
      currentConnectionState: currentConnection.state,
      liveConnection,
      reconciliation,
    };

    if (resolvedDetection.detectedState.issues.length > 0) {
      payload.liveIssues = resolvedDetection.detectedState.issues;
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
          ...(detectedState.modelId ? { modelId: detectedState.modelId } : {}),
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
      ...(detectedState.modelId ? { modelId: detectedState.modelId } : {}),
    };
  }
}

function detectedStateFamilyFromEndpoint(
  endpoint: { profile?: EndpointProfile; protocols: EndpointProtocols },
): EndpointFamily {
  return EndpointShape.readFamily(endpoint);
}
